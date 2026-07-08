export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const PAGE_HINTS = [
  { keys: ['dashboard', 'workbench', 'console', 'kanban', '工作台', '看板'], value: '工作台首页' },
  { keys: ['home', 'landing', 'index', '首页'], value: '首页' },
  { keys: ['detail', 'product', '详情'], value: '商品详情页' },
  { keys: ['form', 'signup', 'apply', '表单'], value: '表单页' },
  { keys: ['login', 'signin', '登录'], value: '登录页' },
];

const INDUSTRY_HINTS = [
  { keys: ['logistics', 'ship', 'delivery', '物流'], value: '物流 / SaaS' },
  { keys: ['ai', 'agent', 'chatbot', '智能'], value: 'AI 工具' },
  { keys: ['shop', 'commerce', 'mall', '电商'], value: '电商' },
  { keys: ['finance', 'bank', 'pay', '金融'], value: '金融' },
  { keys: ['saas', 'crm', 'b2b'], value: 'SaaS' },
];

const DEVICE_HINTS = [
  { keys: ['mobile', 'app', 'iphone', 'android', '移动'], value: 'App' },
  { keys: ['h5', 'wap'], value: 'H5' },
  { keys: ['mini', '小程序'], value: '小程序' },
  { keys: ['web', 'desktop', 'pc'], value: 'Web' },
];

const STYLE_HINTS = [
  { keys: ['dark', 'black', '深色'], value: '深色模式' },
  { keys: ['bento', 'grid'], value: 'Bento Grid' },
  { keys: ['minimal', 'clean', '极简'], value: '极简' },
  { keys: ['blue', 'tech', '科技'], value: '蓝色主色' },
];

function pickByHint(fileName, hints, fallback) {
  const lower = fileName.toLowerCase();
  return hints.find((item) => item.keys.some((key) => lower.includes(key.toLowerCase())))?.value ?? fallback;
}

function tagsByHint(fileName, hints, fallback) {
  const lower = fileName.toLowerCase();
  const tags = hints
    .filter((item) => item.keys.some((key) => lower.includes(key.toLowerCase())))
    .map((item) => item.value);
  return Array.from(new Set([...tags, ...fallback]));
}

function makeId(prefix, seed = '') {
  const random = Math.random().toString(36).slice(2, 8);
  const normalized = String(seed).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  return `${prefix}-${normalized || 'item'}-${random}`;
}

function compactTags(tags) {
  return Array.from(new Set(tags.filter(Boolean))).sort();
}

export function analyzeImage(fileName) {
  const pageType = pickByHint(fileName, PAGE_HINTS, '工作台首页');
  const industry = pickByHint(fileName, INDUSTRY_HINTS, 'SaaS');
  const deviceType = pickByHint(fileName, DEVICE_HINTS, 'Web');
  const styleTags = tagsByHint(fileName, STYLE_HINTS, ['卡片化', '信息层级清晰']);
  const componentTags = pageType === '表单页'
    ? ['表单', '输入框', '主按钮', '校验提示']
    : ['导航栏', '数据卡片', '搜索框', '状态标签'];
  const layoutSummary = `${pageType}采用清晰的模块分区，适合${industry}场景下的${deviceType}端使用。`;

  return {
    pageType,
    industry,
    deviceType,
    styleTags,
    componentTags,
    layoutSummary,
    aiSummary: `${industry} ${pageType}参考图，重点突出页面结构、关键组件和可复用的视觉模式。`,
    designHighlights: [
      '核心信息前置，便于快速理解页面目标',
      '组件分组明确，适合沉淀为可复用设计模式',
      '标签和状态表达清晰，有助于后续检索和复刻',
    ],
    reusableSuggestions: [
      `可参考${pageType}的信息架构`,
      `可复用${componentTags[0]}与${componentTags[1]}的组合方式`,
      `适合用于${industry}相关产品的 Prompt 生成`,
    ],
  };
}

export function createImageRecord({ name, dataUrl, size, type, now = new Date().toISOString() }) {
  if (!SUPPORTED_IMAGE_TYPES.includes(type)) {
    throw new Error('仅支持 PNG、JPG、JPEG、WEBP 格式图片');
  }

  if (size > MAX_IMAGE_SIZE) {
    throw new Error('单张图片不能超过 10MB');
  }

  const analysis = analyzeImage(name);

  return {
    id: makeId('img', name),
    name,
    dataUrl,
    size,
    type,
    uploadTime: now,
    status: '分析成功',
    pageType: analysis.pageType,
    industry: analysis.industry,
    deviceType: analysis.deviceType,
    styleTags: analysis.styleTags,
    componentTags: analysis.componentTags,
    userTags: [],
    layoutSummary: analysis.layoutSummary,
    aiSummary: analysis.aiSummary,
    designHighlights: analysis.designHighlights,
    reusableSuggestions: analysis.reusableSuggestions,
    note: '',
    isFavorite: false,
  };
}

export function imageTags(image) {
  return compactTags([
    image.pageType,
    image.industry,
    image.deviceType,
    ...(image.styleTags ?? []),
    ...(image.componentTags ?? []),
    ...(image.userTags ?? []),
  ]);
}

export function generatePrompt(image, type, now = new Date().toISOString()) {
  const sourceTags = imageTags(image);
  const title = `${image.pageType} ${type} Prompt`;
  const promptIntro = {
    'UI 生成': `请生成一个${image.deviceType}端${image.industry}${image.pageType}界面。`,
    '生图': `请生成一张${image.industry}${image.pageType}风格参考图。`,
    '组件复刻': `请复刻这张参考图中的核心组件组合。`,
    '设计分析': `请从产品设计和 UI 设计角度分析这张${image.pageType}参考图。`,
  }[type] ?? `请基于这张${image.pageType}参考图生成设计 Prompt。`;

  const content = [
    promptIntro,
    `页面结构：${image.layoutSummary ?? image.aiSummary}`,
    `视觉风格：${(image.styleTags ?? []).join('、')}。`,
    `关键组件：${(image.componentTags ?? []).join('、')}。`,
    `设计重点：${(image.designHighlights ?? []).join('；')}。`,
    `复用方向：${(image.reusableSuggestions ?? []).join('；')}。`,
    '请保证信息层级清晰、交互路径明确、视觉细节可落地，并输出可直接用于设计或生成工具的结果。',
  ].join('\n');

  return {
    id: makeId('prompt', `${image.id}-${type}`),
    title,
    type,
    content,
    sourceImageId: image.id,
    tags: sourceTags,
    createTime: now,
    updateTime: now,
    isFavorite: false,
  };
}

function textMatches(text, query) {
  return String(text ?? '').toLowerCase().includes(query.toLowerCase());
}

export function filterImages(images, { query = '', activeTag = '全部', view = '全部' } = {}) {
  const normalizedQuery = query.trim();
  return images.filter((image) => {
    const tags = imageTags(image);
    const haystack = [
      image.name,
      image.pageType,
      image.industry,
      image.deviceType,
      image.aiSummary,
      image.note,
      tags.join(' '),
    ].join(' ');
    const queryOk = !normalizedQuery || textMatches(haystack, normalizedQuery);
    const tagOk = activeTag === '全部' || tags.includes(activeTag);
    const viewOk =
      view === '全部' ||
      (view === '收藏' && image.isFavorite) ||
      (view === '已生成 Prompt' && Number(image.promptCount ?? 0) > 0) ||
      (view === '未生成 Prompt' && Number(image.promptCount ?? 0) === 0);

    return queryOk && tagOk && viewOk;
  });
}

export function filterPrompts(prompts, { query = '', type = '全部' } = {}) {
  const normalizedQuery = query.trim();
  return prompts.filter((prompt) => {
    const haystack = [prompt.title, prompt.type, prompt.content, (prompt.tags ?? []).join(' ')].join(' ');
    const queryOk = !normalizedQuery || textMatches(haystack, normalizedQuery);
    const typeOk = type === '全部' || (type === '收藏' ? prompt.isFavorite : prompt.type === type);
    return queryOk && typeOk;
  });
}

export function uniqueTags(images = [], prompts = []) {
  const imageTagList = images.flatMap(imageTags);
  const promptTagList = prompts.flatMap((prompt) => prompt.tags ?? []);
  return compactTags([...imageTagList, ...promptTagList]);
}
