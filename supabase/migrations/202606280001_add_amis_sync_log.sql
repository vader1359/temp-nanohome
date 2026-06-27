create table if not exists public.amis_sync_log (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  items_processed int default 0,
  items_failed int default 0,
  error text,
  watermark timestamptz
);

alter table public.amis_sync_log enable row level security;

drop policy if exists "amis_sync_log_anon_block_all" on public.amis_sync_log;
create policy "amis_sync_log_anon_block_all"
  on public.amis_sync_log
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists "amis_sync_log_authenticated_block_all" on public.amis_sync_log;
create policy "amis_sync_log_authenticated_block_all"
  on public.amis_sync_log
  for all
  to authenticated
  using (false)
  with check (false);
