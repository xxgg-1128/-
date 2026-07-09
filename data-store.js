// 云端数据层：封装 Supabase Storage + Postgres 的读写。
// 图片文件存 Storage（私有桶），元数据与分析结果存 images 表，
// Prompt 存 prompts 表，全部按 user_id 隔离（RLS 保证）。
import { getSupabaseClient, STORAGE_BUCKET } from './supabase-client.js';

// ---- 工具 ----

function dataUrlToBlob(dataUrl) {
  const [head, base64] = String(dataUrl).split(',');
  const mimeMatch = /data:([^;]+);base64/.exec(head ?? '');
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function extFromType(type) {
  if (/png/i.test(type)) return 'png';
  if (/webp/i.test(type)) return 'webp';
  return 'jpg';
}

// 数据库行 -> 前端 image 对象
function rowToImage(row, dataUrl) {
  return {
    id: row.id,
    name: row.name,
    dataUrl: dataUrl ?? '',
    storagePath: row.storage_path,
    size: row.size ?? 0,
    type: row.type ?? 'image/jpeg',
    status: row.status ?? '分析中',
    uploadTime: row.upload_time ?? row.created_at,
    pageType: row.page_type ?? '',
    industry: row.industry ?? '',
    deviceType: row.device_type ?? '',
    styleTags: row.style_tags ?? [],
    componentTags: row.component_tags ?? [],
    userTags: row.user_tags ?? [],
    layoutSummary: row.layout_summary ?? '',
    aiSummary: row.ai_summary ?? '',
    designHighlights: row.design_highlights ?? [],
    reusableSuggestions: row.reusable_suggestions ?? [],
    note: row.note ?? '',
    isFavorite: Boolean(row.is_favorite),
  };
}

// 前端 image 对象 -> 数据库可更新字段
function imageToRow(image, userId) {
  return {
    id: image.id,
    user_id: userId,
    name: image.name,
    storage_path: image.storagePath,
    status: image.status ?? '分析中',
    page_type: image.pageType || null,
    industry: image.industry || null,
    device_type: image.deviceType || null,
    style_tags: image.styleTags ?? [],
    component_tags: image.componentTags ?? [],
    user_tags: image.userTags ?? [],
    layout_summary: image.layoutSummary || null,
    ai_summary: image.aiSummary || null,
    design_highlights: image.designHighlights ?? [],
    reusable_suggestions: image.reusableSuggestions ?? [],
    note: image.note ?? '',
    is_favorite: Boolean(image.isFavorite),
    updated_at: new Date().toISOString(),
  };
}

function rowToPrompt(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    content: row.content,
    tags: row.tags ?? [],
    isFavorite: Boolean(row.is_favorite),
    sourceImageId: row.source_image_id ?? null,
    updateTime: row.updated_at ?? row.created_at,
  };
}

function promptToRow(prompt, userId) {
  return {
    id: prompt.id,
    user_id: userId,
    title: prompt.title,
    type: prompt.type,
    content: prompt.content ?? '',
    tags: prompt.tags ?? [],
    is_favorite: Boolean(prompt.isFavorite),
    source_image_id: prompt.sourceImageId ?? null,
    updated_at: new Date().toISOString(),
  };
}

// ---- 会话 ----

export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user ?? null;
}

// ---- 图片：上传 / 读取 / 更新 / 删除 ----

// 上传一张图片：写 Storage + 插入 images 记录，返回 image 对象。
export async function uploadImage({ name, dataUrl, size, type }) {
  const supabase = getSupabaseClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('请先登录后再上传图片。');

  const imageId = crypto.randomUUID();
  const ext = extFromType(type);
  const storagePath = `${user.id}/${imageId}/original.${ext}`;
  const blob = dataUrlToBlob(dataUrl);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, { contentType: type || 'image/jpeg', upsert: true });
  if (uploadError) throw new Error(`图片上传失败：${uploadError.message}`);

  const row = {
    id: imageId,
    user_id: user.id,
    name,
    storage_path: storagePath,
    status: '分析中',
    style_tags: [],
    component_tags: [],
    user_tags: [],
    design_highlights: [],
    reusable_suggestions: [],
    note: '',
    is_favorite: false,
  };

  const { data, error } = await supabase.from('images').insert(row).select().single();
  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw new Error(`图片记录保存失败：${error.message}`);
  }

  return rowToImage(data, dataUrl);
}

// 为某个 storage_path 生成临时可访问 URL（私有桶必须签名）。
export async function signImageUrl(storagePath, expiresIn = 60 * 60) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) return '';
  return data?.signedUrl ?? '';
}

// 拉取当前用户全部图片（含签名 URL）。
export async function fetchImages() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('images')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`加载图片失败：${error.message}`);

  const rows = data ?? [];
  const signed = await Promise.all(rows.map((row) => signImageUrl(row.storage_path)));
  return rows.map((row, i) => rowToImage(row, signed[i]));
}

// 更新图片元数据/分析结果。
export async function saveImage(image) {
  const supabase = getSupabaseClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('登录状态失效，请重新登录。');
  const { error } = await supabase.from('images').upsert(imageToRow(image, user.id));
  if (error) throw new Error(`保存图片失败：${error.message}`);
}

// 删除图片：先删 Storage 文件，再删记录。
export async function deleteImage(image) {
  const supabase = getSupabaseClient();
  if (image.storagePath) {
    await supabase.storage.from(STORAGE_BUCKET).remove([image.storagePath]);
  }
  const { error } = await supabase.from('images').delete().eq('id', image.id);
  if (error) throw new Error(`删除图片失败：${error.message}`);
}

// ---- Prompt：读取 / 保存 / 删除 ----

export async function fetchPrompts() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`加载 Prompt 失败：${error.message}`);
  return (data ?? []).map(rowToPrompt);
}

export async function savePrompt(prompt) {
  const supabase = getSupabaseClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('登录状态失效，请重新登录。');
  const { error } = await supabase.from('prompts').upsert(promptToRow(prompt, user.id));
  if (error) throw new Error(`保存 Prompt 失败：${error.message}`);
}

export async function deletePrompt(promptId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('prompts').delete().eq('id', promptId);
  if (error) throw new Error(`删除 Prompt 失败：${error.message}`);
}