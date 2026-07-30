begin;

\ir fixtures.sql
\ir ../seed.sql
\set baseline_id '00000000-0000-4000-8000-000000000101'

set local role postgres;

-- Synthetic local fixture only: make two approved variants unambiguously table
-- and lamp records so the contract tests cannot depend on production facts.
update public.variants
set
  name = 'Dining table fixture 1',
  name_vi = 'Bàn ăn fixture 1',
  filter_category = 'tables',
  filter_sub_category = 'dining_tables',
  filter_brand = 'acme-test-brand-1',
  filter_room = array['dining-room'],
  filter_room_vi = array['Phòng ăn'],
  packshot_url = 'https://res.cloudinary.com/nanohome-web/image/upload/test/table-1',
  source_updated_at = now() - interval '1 hour',
  price = 10,
  stock = 10
where id = :'variant_id_1';

update public.variants
set
  name = 'Table lamp fixture',
  name_vi = 'Đèn bàn fixture',
  filter_category = 'lighting',
  filter_sub_category = 'table_lamps',
  filter_brand = 'acme-test-brand-1',
  filter_room = array['living-room'],
  filter_room_vi = array['Phòng khách'],
  packshot_url = 'https://res.cloudinary.com/nanohome-web/image/upload/test/lamp-1',
  source_updated_at = now() - interval '1 hour',
  price = 5,
  stock = 10
where id = :'variant_id_2';

update public.variants
set
  name = 'Dining table fixture 2',
  name_vi = 'Bàn ăn fixture 2',
  filter_category = 'tables',
  filter_sub_category = 'dining_tables',
  filter_brand = 'acme-test-brand-2',
  filter_room = array['dining-room'],
  filter_room_vi = array['Phòng ăn'],
  packshot_url = 'https://res.cloudinary.com/nanohome-web/image/upload/test/table-2',
  source_updated_at = now() - interval '1 hour',
  price = 20,
  stock = 10
where id = :'variant_id_3';

insert into public.amis_inventory_baselines (id, completed_at, is_active)
values (:'baseline_id', now(), true);
insert into public.amis_inventory_baseline_lines (baseline_id, sku, stock)
select :'baseline_id', sku, 10
from public.variants
where id in (:'variant_id_1', :'variant_id_2', :'variant_id_3');
insert into public.amis_inventory_sync_state (sync_key, active_baseline_id)
values ('inventory', :'baseline_id');

select plan(12);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'search_public_chat_catalog_v2'
  ),
  'structured public catalog RPC exists'
);
select ok(
  has_function_privilege(
    'anon',
    'public.search_public_chat_catalog_v2(text,text[],text[],text[],text[],text[],text[],text[],text[],text[],numeric,numeric,text,text,integer)',
    'execute'
  ),
  'anon can execute the public catalog RPC'
);
select is(
  (select count(*) from public.search_public_chat_catalog_v2(
    null, array['table']::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], null, null, 'include_unknown', 'relevance', 8
  )),
  2::bigint,
  'table family returns only the two table fixtures'
);
select ok(
  not exists (
    select 1 from public.search_public_chat_catalog_v2(
      null, array['table']::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], null, null, 'include_unknown', 'relevance', 8
    ) where lower(name) like '%lamp%'
  ),
  'table family never returns the lamp fixture'
);
select is(
  (select count(*) from public.search_public_chat_catalog_v2(
    null, array['lamp']::text[], array['table_lamp']::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], null, null, 'include_unknown', 'relevance', 8
  )),
  1::bigint,
  'table_lamp subtype returns the lamp fixture only'
);
select is(
  (select count(*) from public.search_public_chat_catalog_v2(
    null, array['table']::text[], '{}'::text[], '{}'::text[], '{}'::text[], array['dining']::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], null, null, 'available_only', 'relevance', 8
  )),
  2::bigint,
  'available_only retains only fresh-stock table fixtures'
);
select is(
  (select count(*) from public.search_public_chat_catalog_v2(
    null, array['table']::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], null, 15, 'include_unknown', 'relevance', 8
  )),
  1::bigint,
  'fixed-price budget excludes the over-budget table'
);
select is(
  (select count(*) from public.search_public_chat_catalog_v2(
    null, array['table']::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], null, null, 'include_unknown', 'price_asc', 8
  ) where public_price_mode = 'fixed'),
  2::bigint,
  'price ordering excludes non-fixed price modes'
);
select is(
  (select array_agg(public_price order by public_price) from public.search_public_chat_catalog_v2(
    null, array['table']::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], null, null, 'include_unknown', 'price_asc', 8
  )),
  array[10::numeric, 20::numeric],
  'price ascending result is deterministic'
);
select ok(
  not exists (
    select 1
    from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'search_public_chat_catalog_v2%'
      and coalesce(parameter_name, '') in ('raw', 'private', 'customer_data')
  ),
  'RPC parameters expose no raw or private field'
);
select ok(
  not exists (
    select 1
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'search_public_chat_catalog_v2'
      and grantee = 'public'
      and privilege_type = 'EXECUTE'
  ),
  'RPC has no broad PUBLIC execute grant'
);
select is(
  (select count(*) from public.search_public_chat_catalog_v2(
    'fixture', '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], '{}'::text[], null, null, 'include_unknown', 'relevance', 8
  ) where public_price_mode in ('fixed', 'contact', 'unavailable')),
  3::bigint,
  'public projection contains only typed price modes for fixture rows'
);

select * from finish();
rollback;
