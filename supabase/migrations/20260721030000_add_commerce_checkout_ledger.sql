create table if not exists public.commerce_checkouts (
  id uuid primary key default gen_random_uuid(),
  web_order_id text not null,
  owner_scope text not null,
  idempotency_key text not null,
  payload_hash text not null,
  amis_sale_order_id text,
  app_trans_id text,
  zp_trans_id text,
  callback_digest text,
  status text not null default 'started'
    check (status in ('started', 'held', 'paid', 'refunded', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_checkouts_web_order_id_check
    check (web_order_id collate "C" ~ '^WEB-[A-Za-z0-9][A-Za-z0-9_-]*$'),
  constraint commerce_checkouts_idempotency_key_nonempty
    check (octet_length(idempotency_key) > 0),
  constraint commerce_checkouts_owner_scope_nonempty
    check (octet_length(owner_scope) > 0),
  constraint commerce_checkouts_payload_hash_nonempty
    check (octet_length(payload_hash) > 0),
  constraint commerce_checkouts_amis_sale_order_id_nonempty
    check (amis_sale_order_id is null or octet_length(amis_sale_order_id) > 0),
  constraint commerce_checkouts_app_trans_id_nonempty
    check (app_trans_id is null or octet_length(app_trans_id) > 0),
  constraint commerce_checkouts_zp_trans_id_nonempty
    check (zp_trans_id is null or octet_length(zp_trans_id) > 0),
  constraint commerce_checkouts_callback_digest_nonempty
    check (callback_digest is null or octet_length(callback_digest) > 0)
);

create unique index if not exists commerce_checkouts_web_order_id_key
  on public.commerce_checkouts (web_order_id collate "C");
create unique index if not exists commerce_checkouts_owner_idempotency_key
  on public.commerce_checkouts (owner_scope collate "C", idempotency_key collate "C");
create unique index if not exists commerce_checkouts_amis_sale_order_id
  on public.commerce_checkouts (amis_sale_order_id collate "C")
  where amis_sale_order_id is not null;
create unique index if not exists commerce_checkouts_app_trans_id
  on public.commerce_checkouts (app_trans_id collate "C")
  where app_trans_id is not null;
create unique index if not exists commerce_checkouts_zp_trans_id
  on public.commerce_checkouts (zp_trans_id collate "C")
  where zp_trans_id is not null;
create unique index if not exists commerce_checkouts_callback_digest
  on public.commerce_checkouts (callback_digest collate "C")
  where callback_digest is not null;

create table if not exists public.commerce_inventory_holds (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references public.commerce_checkouts(id),
  raw_sku text collate "C" not null,
  warehouse text collate "C" not null,
  quantity integer not null check (quantity > 0),
  status text not null default 'held' check (status in ('held', 'released', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  constraint commerce_inventory_holds_raw_sku_nonempty check (octet_length(raw_sku) > 0),
  constraint commerce_inventory_holds_warehouse_nonempty check (octet_length(warehouse) > 0),
  constraint commerce_inventory_holds_expiry_window check (expires_at <= created_at + interval '10 minutes')
);

create unique index if not exists commerce_inventory_holds_active_key
  on public.commerce_inventory_holds (checkout_id, raw_sku collate "C", warehouse collate "C")
  where status = 'held';
create index if not exists commerce_inventory_holds_expiry_idx
  on public.commerce_inventory_holds (expires_at) where status = 'held';

create table if not exists public.commerce_payment_ledger (
  id bigint generated always as identity primary key,
  checkout_id uuid not null references public.commerce_checkouts(id),
  app_trans_id text collate "C" not null,
  zp_trans_id text collate "C",
  amount numeric(15,2) not null check (amount > 0),
  currency text not null default 'VND' check (currency = 'VND'),
  event text not null check (event in ('authorized', 'captured', 'failed')),
  callback_digest text collate "C",
  recorded_at timestamptz not null default now(),
  unique (app_trans_id),
  unique (zp_trans_id),
  constraint commerce_payment_ledger_app_trans_id_nonempty check (octet_length(app_trans_id) > 0),
  constraint commerce_payment_ledger_zp_trans_id_nonempty check (zp_trans_id is null or octet_length(zp_trans_id) > 0),
  constraint commerce_payment_ledger_callback_digest_nonempty check (callback_digest is null or octet_length(callback_digest) > 0),
  unique (callback_digest)
);

create table if not exists public.commerce_refund_ledger (
  id bigint generated always as identity primary key,
  checkout_id uuid not null references public.commerce_checkouts(id),
  zp_trans_id text collate "C" not null,
  m_refund_id text collate "C" not null unique,
  amount numeric(15,2) not null check (amount > 0),
  currency text not null default 'VND' check (currency = 'VND'),
  event text not null check (event in ('requested', 'completed', 'failed')),
  reason text not null,
  actor text not null,
  request_digest text collate "C" not null,
  provider_status text,
  callback_digest text collate "C" unique,
  constraint commerce_refund_ledger_zp_trans_id_nonempty check (octet_length(zp_trans_id) > 0),
  constraint commerce_refund_ledger_m_refund_id_nonempty check (octet_length(m_refund_id) > 0),
  constraint commerce_refund_ledger_reason_nonempty check (octet_length(reason) > 0),
  constraint commerce_refund_ledger_actor_nonempty check (octet_length(actor) > 0),
  constraint commerce_refund_ledger_request_digest_nonempty check (octet_length(request_digest) > 0),
  constraint commerce_refund_ledger_callback_digest_nonempty check (callback_digest is null or octet_length(callback_digest) > 0),
  constraint commerce_refund_ledger_request_identity unique (checkout_id, request_digest),
  recorded_at timestamptz not null default now()
);

create or replace function public.commerce_expire_holds()
returns integer language sql security definer set search_path = pg_catalog, public
as $$
  with expired as (
    update public.commerce_inventory_holds
    set status = 'expired'
    where status = 'held' and expires_at <= clock_timestamp()
    returning 1
  ) select count(*)::integer from expired;
$$;

create or replace function public.commerce_prevent_mutation()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = 'P0001', message = 'commerce ledger is append-only';
end;
$$;

drop trigger if exists commerce_payment_ledger_append_only on public.commerce_payment_ledger;
create trigger commerce_payment_ledger_append_only before update or delete on public.commerce_payment_ledger
for each row execute function public.commerce_prevent_mutation();
drop trigger if exists commerce_refund_ledger_append_only on public.commerce_refund_ledger;
create trigger commerce_refund_ledger_append_only before update or delete on public.commerce_refund_ledger
for each row execute function public.commerce_prevent_mutation();

alter table public.commerce_checkouts enable row level security;
alter table public.commerce_inventory_holds enable row level security;
alter table public.commerce_payment_ledger enable row level security;
alter table public.commerce_refund_ledger enable row level security;

revoke all on public.commerce_checkouts, public.commerce_inventory_holds,
  public.commerce_payment_ledger, public.commerce_refund_ledger from public, anon, authenticated;
revoke all on function public.commerce_expire_holds() from public, anon, authenticated;
revoke all on function public.commerce_prevent_mutation() from public, anon, authenticated;
grant all on public.commerce_checkouts, public.commerce_inventory_holds,
  public.commerce_payment_ledger, public.commerce_refund_ledger to service_role;
grant usage, select on sequence public.commerce_payment_ledger_id_seq,
  public.commerce_refund_ledger_id_seq to service_role;
grant execute on function public.commerce_expire_holds() to service_role;
