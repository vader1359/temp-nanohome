alter table public.amis_sale_order_summaries
  add column engagement_kind text not null default 'quoted_or_interested'
    check (engagement_kind in ('purchased', 'quoted_or_interested')),
  add column discussed_variant_ids text[] not null default '{}';

create table public.amis_contact_snapshots (
  amis_contact_id text primary key,
  amis_customer_id text not null references public.amis_customer_snapshots(amis_customer_id),
  source_updated_at timestamptz not null,
  source_state text not null check (source_state in ('active', 'deleted', 'invalid')),
  payload_digest text not null,
  mapper_version text not null
);

create table public.customer_memory_briefs (
  link_id uuid primary key references public.customer_amis_links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  brief jsonb not null,
  source_updated_at timestamptz not null,
  projection_version text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(brief) = 'object')
);

alter table public.amis_contact_snapshots enable row level security;
alter table public.customer_memory_briefs enable row level security;

create policy "contact snapshots deny browser" on public.amis_contact_snapshots
  for all to anon, authenticated using (false) with check (false);
create policy "customer memory briefs deny browser" on public.customer_memory_briefs
  for all to anon, authenticated using (false) with check (false);

revoke all on public.amis_contact_snapshots, public.customer_memory_briefs from anon, authenticated;

comment on table public.amis_contact_snapshots is 'Plan 03 safe contact linkage metadata only; no names, email addresses, phone numbers, or raw AMIS payloads.';
comment on table public.customer_memory_briefs is 'Plan 03 service-only Customer Advisor brief; no raw AMIS payloads or contact fields.';
comment on column public.amis_sale_order_summaries.engagement_kind is 'Plan 03 restricted classification derived from active order approval state.';
comment on column public.amis_sale_order_summaries.discussed_variant_ids is 'Plan 03 canonical storefront variants from active quoted or interested orders only.';
