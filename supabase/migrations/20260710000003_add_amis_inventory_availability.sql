create table public.amis_inventory_baselines (
  id uuid primary key default gen_random_uuid(),
  completed_at timestamptz not null,
  is_active boolean not null default false
);

create unique index amis_inventory_one_active_baseline
  on public.amis_inventory_baselines (is_active) where is_active;

create table public.amis_inventory_baseline_lines (
  baseline_id uuid not null references public.amis_inventory_baselines(id) on delete cascade,
  sku text not null,
  stock numeric not null,
  primary key (baseline_id, sku)
);

create table public.amis_inventory_sync_state (
  sync_key text primary key,
  active_baseline_id uuid references public.amis_inventory_baselines(id) on delete set null,
  sale_order_watermark timestamptz
);

create table public.amis_sale_orders (
  amis_order_id bigint primary key,
  modified_date timestamptz not null,
  approved_status text,
  approved_date timestamptz,
  status text,
  is_deleted boolean not null
);

create table public.amis_sale_order_lines (
  amis_line_id bigint primary key,
  amis_order_id bigint not null references public.amis_sale_orders(amis_order_id) on delete cascade,
  sku text,
  amount numeric,
  produced_quantity numeric,
  total_amount_delivered numeric,
  is_note_row boolean not null,
  is_deleted boolean not null default false
);

create index amis_sale_orders_modified_date_index on public.amis_sale_orders (modified_date desc);
create index amis_sale_order_lines_order_id_index on public.amis_sale_order_lines (amis_order_id);

alter table public.amis_inventory_baselines enable row level security;
alter table public.amis_inventory_baseline_lines enable row level security;
alter table public.amis_inventory_sync_state enable row level security;
alter table public.amis_sale_orders enable row level security;
alter table public.amis_sale_order_lines enable row level security;

create policy "amis_inventory_baselines_anon_block_all" on public.amis_inventory_baselines for all to anon using (false) with check (false);
create policy "amis_inventory_baselines_authenticated_block_all" on public.amis_inventory_baselines for all to authenticated using (false) with check (false);
create policy "amis_inventory_baseline_lines_anon_block_all" on public.amis_inventory_baseline_lines for all to anon using (false) with check (false);
create policy "amis_inventory_baseline_lines_authenticated_block_all" on public.amis_inventory_baseline_lines for all to authenticated using (false) with check (false);
create policy "amis_inventory_sync_state_anon_block_all" on public.amis_inventory_sync_state for all to anon using (false) with check (false);
create policy "amis_inventory_sync_state_authenticated_block_all" on public.amis_inventory_sync_state for all to authenticated using (false) with check (false);
create policy "amis_sale_orders_anon_block_all" on public.amis_sale_orders for all to anon using (false) with check (false);
create policy "amis_sale_orders_authenticated_block_all" on public.amis_sale_orders for all to authenticated using (false) with check (false);
create policy "amis_sale_order_lines_anon_block_all" on public.amis_sale_order_lines for all to anon using (false) with check (false);
create policy "amis_sale_order_lines_authenticated_block_all" on public.amis_sale_order_lines for all to authenticated using (false) with check (false);
