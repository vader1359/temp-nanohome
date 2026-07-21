create table public.customer_amis_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amis_customer_id text not null,
  state text not null check (state in ('proposed', 'verified', 'active', 'rejected', 'suspended', 'revoked')),
  method text not null check (method in ('staff_exact_code', 'staff_selection', 'trusted_migration', 'future_customer_code')),
  evidence_category text not null,
  actor_id uuid references auth.users(id) on delete set null,
  review_reason text,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, amis_customer_id)
);

create unique index customer_amis_links_active_customer_idx
  on public.customer_amis_links (amis_customer_id) where state = 'active';

create table public.amis_customer_snapshots (
  amis_customer_id text primary key,
  customer_type text,
  customer_since_bucket text,
  preferred_room_ids text[] not null default '{}',
  preferred_brand_ids text[] not null default '{}',
  project_stage text,
  customer_visible_summary text,
  source_updated_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  source_state text not null check (source_state in ('active', 'deleted', 'merged', 'invalid')),
  payload_digest text not null,
  mapper_version text not null
);

create table public.amis_sale_order_summaries (
  amis_sale_order_id text primary key,
  amis_customer_id text not null references public.amis_customer_snapshots(amis_customer_id),
  source_updated_at timestamptz not null,
  purchased_variant_ids text[] not null default '{}',
  source_state text not null check (source_state in ('active', 'deleted', 'invalid')),
  payload_digest text not null,
  mapper_version text not null
);

create table public.customer_memory_projections (
  link_id uuid primary key references public.customer_amis_links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  memory jsonb not null,
  source_updated_at timestamptz not null,
  projection_version text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(memory) = 'object')
);

create table public.amis_sync_cursors (
  entity text primary key check (entity in ('customers', 'sale_orders')),
  watermark timestamptz,
  last_success_at timestamptz,
  run_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.customer_amis_links enable row level security;
alter table public.amis_customer_snapshots enable row level security;
alter table public.amis_sale_order_summaries enable row level security;
alter table public.customer_memory_projections enable row level security;
alter table public.amis_sync_cursors enable row level security;

create policy "customer memory projection own read" on public.customer_memory_projections
  for select to authenticated using (user_id = auth.uid());
create policy "customer memory links deny browser" on public.customer_amis_links
  for all to anon, authenticated using (false) with check (false);
create policy "customer snapshots deny browser" on public.amis_customer_snapshots
  for all to anon, authenticated using (false) with check (false);
create policy "sale order summaries deny browser" on public.amis_sale_order_summaries
  for all to anon, authenticated using (false) with check (false);
create policy "sync cursors deny browser" on public.amis_sync_cursors
  for all to anon, authenticated using (false) with check (false);

revoke all on public.customer_amis_links, public.amis_customer_snapshots,
  public.amis_sale_order_summaries, public.amis_sync_cursors from anon, authenticated;
grant select on public.customer_memory_projections to authenticated;

comment on table public.customer_memory_projections is 'Plan 03 safe CustomerMemory only; no raw AMIS payloads or notes.';
comment on table public.customer_amis_links is 'Plan 03 staff-controlled verified AMIS links; evidence secrets are never stored.';
