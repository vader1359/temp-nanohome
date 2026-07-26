begin;

\ir fixtures.sql

set local role postgres;

create temporary table foundation_account_manifest_targets (
  relation_name text primary key,
  ownership_column text not null
) on commit drop;

insert into foundation_account_manifest_targets (relation_name, ownership_column)
values
  ('profiles', 'account_id'),
  ('carts', 'account_id'),
  ('orders', 'account_id'),
  ('order_status_history', 'actor_account_id'),
  ('customer_identity_ledger', 'account_id'),
  ('customer_amis_links', 'account_id'),
  ('customer_memory_projections', 'account_id'),
  ('conversations', 'owner_account_id'),
  ('vision_analysis_requests', 'owner_account_id'),
  ('room_scenes', 'owner_account_id'),
  ('vision_object_crops', 'owner_account_id');

create temporary view foundation_account_manifest_fks as
select
  target.relation_name,
  target.ownership_column,
  constraint_row.conname,
  constraint_row.conrelid,
  attribute_row.attnum
from foundation_account_manifest_targets target
join pg_class relation_row
  on relation_row.oid = format('public.%I', target.relation_name)::regclass
join pg_attribute attribute_row
  on attribute_row.attrelid = relation_row.oid
 and attribute_row.attname = target.ownership_column
 and not attribute_row.attisdropped
join pg_constraint constraint_row
  on constraint_row.conrelid = relation_row.oid
 and constraint_row.contype = 'f'
 and constraint_row.confrelid = 'public.customer_accounts'::regclass
 and constraint_row.conkey = array[attribute_row.attnum];

select plan(14);

select is(
  (select count(*) from foundation_account_manifest_targets),
  11::bigint,
  'Plan 04 ownership manifest inventories every required relational target'
);

select is(
  (select count(*) from foundation_account_manifest_fks),
  11::bigint,
  'every manifest ownership column has a direct foreign key to customer_accounts.id'
);

select is(
  (
    select count(*)
    from foundation_account_manifest_targets target
    join pg_class relation_row
      on relation_row.oid = format('public.%I', target.relation_name)::regclass
    join pg_attribute attribute_row
      on attribute_row.attrelid = relation_row.oid
     and attribute_row.attname = target.ownership_column
     and not attribute_row.attisdropped
    where not exists (
      select 1
      from pg_index index_row
      where index_row.indrelid = relation_row.oid
        and attribute_row.attnum = any(index_row.indkey)
    )
  ),
  0::bigint,
  'every manifest ownership column is indexed for account-scoped access'
);

select lives_ok(
  $proof$
    do $orphans$
    declare
      reference record;
      orphan_count bigint;
    begin
      for reference in select * from foundation_account_manifest_fks loop
        execute format(
          'select count(*) from public.%I child left join public.customer_accounts account on account.id = child.%I where child.%I is not null and account.id is null',
          reference.relation_name,
          reference.ownership_column,
          reference.ownership_column
        ) into orphan_count;

        if orphan_count <> 0 then
          raise exception 'orphaned account ownership in %.%', reference.relation_name, reference.ownership_column;
        end if;
      end loop;
    end;
  $orphans$;
  $proof$,
  'all manifest ownership foreign keys have zero orphaned rows after backfill'
);

select is(
  (
    select count(*)
    from pg_policies policy_row
    join foundation_account_manifest_targets target
      on policy_row.schemaname = 'public'
     and policy_row.tablename = target.relation_name
    where position('auth.uid(' in coalesce(policy_row.qual, '')) > 0
       or position('auth.uid(' in coalesce(policy_row.with_check, '')) > 0
  ),
  0::bigint,
  'account ownership policies contain no direct auth.uid() access path'
);

select ok(
  (
    select count(*)
    from pg_policies policy_row
    join foundation_account_manifest_targets target
      on policy_row.schemaname = 'public'
     and policy_row.tablename = target.relation_name
    where coalesce(policy_row.qual, '') like '%current_customer_account_id%'
       or coalesce(policy_row.with_check, '') like '%current_customer_account_id%'
  ) >= 10,
  'account-scoped RLS policies route through current_customer_account_id()'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'room_photos_owner_read'
      and coalesce(qual, '') like '%is_room_photo_path_readable%'
  ),
  1::bigint,
  'room-photos storage policy delegates ownership to the internal-account path helper'
);

select ok(
  (select pg_get_functiondef('public.current_customer_account_id()'::regprocedure)) like '%customer_firebase_principals%'
  and (select pg_get_functiondef('public.current_customer_account_id()'::regprocedure)) like '%subject !~%'
  and (select pg_get_functiondef('public.current_customer_account_id()'::regprocedure)) like '%provider.issuer = claim_issuer%'
  and (select pg_get_functiondef('public.current_customer_account_id()'::regprocedure)) like '%provider.audience = claim_audience%',
  'current_customer_account_id() validates mapped Firebase identity, UUID legacy shape, issuer, and audience'
);

select ok(
  (select pg_get_functiondef('public.capture_order_from_cart(text,text,text,text,text,text,text,text)'::regprocedure)) like '%v_account_id := public.current_customer_account_id()%'
  and (select pg_get_functiondef('public.capture_order_from_cart(text,text,text,text,text,text,text,text)'::regprocedure)) like '%checkout_unauthorized%',
  'checkout resolves internal account ownership before any legacy fallback'
);

create table public.foundation_manifest_forbidden_policy_fixture (id uuid primary key);
alter table public.foundation_manifest_forbidden_policy_fixture enable row level security;
create policy foundation_manifest_forbidden_direct_auth_uid
  on public.foundation_manifest_forbidden_policy_fixture
  for select to authenticated
  using (auth.uid() is not null);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'foundation_manifest_forbidden_policy_fixture'
      and position('auth.uid(' in coalesce(qual, '')) > 0
  ),
  1::bigint,
  'manifest detector catches a temporary forbidden direct-auth policy fixture'
);

drop table public.foundation_manifest_forbidden_policy_fixture;

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'foundation_manifest_forbidden_policy_fixture'
  ),
  0::bigint,
  'temporary forbidden-policy fixture is removed after detector proof'
);

-- Direct references are permitted only where the Foundation contract documents
-- a legacy bridge: checkout's safe UUID fallback and verified Supabase binding.
select is(
  (
    select count(*)
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname in ('current_customer_account_id', 'current_legacy_supabase_user_id', 'capture_order_from_cart', 'bind_verified_customer_identity')
      and (
        position('auth.uid(' in pg_get_functiondef(procedure_row.oid)) > 0
        or position('auth.users' in pg_get_functiondef(procedure_row.oid)) > 0
      )
      and procedure_row.proname not in ('capture_order_from_cart', 'bind_verified_customer_identity')
  ),
  0::bigint,
  'only explicitly documented legacy bridge functions retain direct auth references'
);

select is(
  (
    select count(*)
    from public.customer_identity_ledger
    where user_id is not null
      and account_id is null
  ),
  0::bigint,
  'legacy identity ledger rows have no missing internal account backfill'
);

select is(
  (
    select (
      select count(*)
      from public.customer_amis_links
      where account_id is null
    ) + (
      select count(*)
      from public.customer_memory_projections
      where account_id is null
    )
  ),
  0::bigint,
  'customer memory targets have no missing internal account backfill'
);

select * from finish();
rollback;
