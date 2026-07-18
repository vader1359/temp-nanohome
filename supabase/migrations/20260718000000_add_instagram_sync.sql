create table if not exists public.instagram_sync_state (
  sync_key text primary key default 'primary' check (sync_key = 'primary'),
  access_token text not null,
  expires_at timestamptz not null,
  account_id text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_media (
  id text primary key,
  caption text,
  media_type text not null,
  media_url text,
  permalink text,
  thumbnail_url text,
  published_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table public.instagram_sync_state enable row level security;
alter table public.instagram_media enable row level security;

create policy "instagram_sync_state_anon_block_all" on public.instagram_sync_state for all to anon using (false) with check (false);
create policy "instagram_sync_state_authenticated_block_all" on public.instagram_sync_state for all to authenticated using (false) with check (false);
create policy "instagram_media_anon_read" on public.instagram_media for select to anon using (true);
create policy "instagram_media_authenticated_read" on public.instagram_media for select to authenticated using (true);
create policy "instagram_media_anon_block_write" on public.instagram_media for all to anon using (false) with check (false);
create policy "instagram_media_authenticated_block_write" on public.instagram_media for all to authenticated using (false) with check (false);
