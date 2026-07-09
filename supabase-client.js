// Supabase 客户端配置（前端）
// 说明：
// - anon key 属于「可公开」密钥，允许写入前端；真正的安全由数据库 RLS 保证。
// - service_role 密钥【绝不能】出现在前端，仅配置到 Vercel 服务端环境变量。
// - 通过 CDN 引入的 @supabase/supabase-js 会挂载到 window.supabase。

export const SUPABASE_URL = 'https://mkivghvavxhcpsldenfs.supabase.co';

// anon public key（可公开）。若后续重置，仅需替换此处。
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1raXZnaHZhdnhoY3BzbGRlbmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDg4ODksImV4cCI6MjA5OTA4NDg4OX0.Gl836-xVnOQqCnfkBYcPJ0J08FPkItTCPnzbA0BN75Y';

// 私有存储桶名称，需在 Supabase 控制台手动创建
export const STORAGE_BUCKET = 'designref-images';

let client = null;

// 返回 Supabase 客户端单例。
export function getSupabaseClient() {
  if (client) return client;
  const globalSupabase = typeof window !== 'undefined' ? window.supabase : null;
  if (!globalSupabase || typeof globalSupabase.createClient !== 'function') {
    throw new Error('Supabase 客户端未加载，请检查 index.html 中的 CDN 引用。');
  }
  client = globalSupabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}