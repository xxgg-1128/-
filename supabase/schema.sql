create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  thumbnail_path text,
  upload_time timestamptz not null default now(),
  status text not null default '分析中',
  page_type text,
  industry text,
  device_type text,
  style_tags text[] not null default '{}',
  component_tags text[] not null default '{}',
  user_tags text[] not null default '{}',
  layout_summary text,
  ai_summary text,
  design_highlights text[] not null default '{}',
  reusable_suggestions text[] not null default '{}',
  note text not null default '',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null,
  content text not null,
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.image_prompts (
  image_id uuid not null references public.images(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (image_id, prompt_id)
);

create table if not exists public.image_events (
  id uuid primary key default gen_random_uuid(),
  image_id uuid references public.images(id) on delete cascade,
  prompt_id uuid references public.prompts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists images_user_id_created_at_idx on public.images(user_id, created_at desc);
create index if not exists images_user_id_favorite_idx on public.images(user_id, is_favorite);
create index if not exists prompts_user_id_created_at_idx on public.prompts(user_id, created_at desc);
create index if not exists prompts_user_id_type_idx on public.prompts(user_id, type);
create index if not exists image_prompts_user_id_idx on public.image_prompts(user_id);

alter table public.profiles enable row level security;
alter table public.images enable row level security;
alter table public.prompts enable row level security;
alter table public.image_prompts enable row level security;
alter table public.image_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "images_select_own" on public.images;
create policy "images_select_own" on public.images
  for select using (auth.uid() = user_id);

drop policy if exists "images_insert_own" on public.images;
create policy "images_insert_own" on public.images
  for insert with check (auth.uid() = user_id);

drop policy if exists "images_update_own" on public.images;
create policy "images_update_own" on public.images
  for update using (auth.uid() = user_id);

drop policy if exists "images_delete_own" on public.images;
create policy "images_delete_own" on public.images
  for delete using (auth.uid() = user_id);

drop policy if exists "prompts_select_own" on public.prompts;
create policy "prompts_select_own" on public.prompts
  for select using (auth.uid() = user_id);

drop policy if exists "prompts_insert_own" on public.prompts;
create policy "prompts_insert_own" on public.prompts
  for insert with check (auth.uid() = user_id);

drop policy if exists "prompts_update_own" on public.prompts;
create policy "prompts_update_own" on public.prompts
  for update using (auth.uid() = user_id);

drop policy if exists "prompts_delete_own" on public.prompts;
create policy "prompts_delete_own" on public.prompts
  for delete using (auth.uid() = user_id);

drop policy if exists "image_prompts_select_own" on public.image_prompts;
create policy "image_prompts_select_own" on public.image_prompts
  for select using (auth.uid() = user_id);

drop policy if exists "image_prompts_insert_own" on public.image_prompts;
create policy "image_prompts_insert_own" on public.image_prompts
  for insert with check (auth.uid() = user_id);

drop policy if exists "image_prompts_delete_own" on public.image_prompts;
create policy "image_prompts_delete_own" on public.image_prompts
  for delete using (auth.uid() = user_id);

drop policy if exists "image_events_select_own" on public.image_events;
create policy "image_events_select_own" on public.image_events
  for select using (auth.uid() = user_id);

drop policy if exists "image_events_insert_own" on public.image_events;
create policy "image_events_insert_own" on public.image_events
  for insert with check (auth.uid() = user_id);

-- ---- 前端数据层所需的补充列 ----
-- images 记录原始文件大小与 MIME 类型（可选）
alter table public.images add column if not exists size bigint;
alter table public.images add column if not exists type text;

-- prompts 直接关联来源图片（前端使用 source_image_id 而非 image_prompts 关联表）
alter table public.prompts
  add column if not exists source_image_id uuid references public.images(id) on delete set null;
create index if not exists prompts_source_image_id_idx on public.prompts(source_image_id);

-- ---- Storage 私有桶 designref-images 的行级安全 ----
-- 仅允许用户读写自己命名空间下的对象：路径首段必须等于其 user_id。
drop policy if exists "designref_images_select_own" on storage.objects;
create policy "designref_images_select_own" on storage.objects
  for select using (
    bucket_id = 'designref-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "designref_images_insert_own" on storage.objects;
create policy "designref_images_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'designref-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "designref_images_update_own" on storage.objects;
create policy "designref_images_update_own" on storage.objects
  for update using (
    bucket_id = 'designref-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "designref_images_delete_own" on storage.objects;
create policy "designref_images_delete_own" on storage.objects
  for delete using (
    bucket_id = 'designref-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

