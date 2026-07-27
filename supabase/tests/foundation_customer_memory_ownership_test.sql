begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000181', 'authenticated', 'authenticated', 'memory-owner@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000182', 'authenticated', 'authenticated', 'memory-other@example.test', '', now());

insert into public.customer_visitors (id, visitor_token_hash)
values
  ('00000000-0000-4000-8000-000000000183', repeat('a', 64)),
  ('00000000-0000-4000-8000-000000000184', repeat('b', 64));

insert into public.customer_sessions (id, visitor_id, session_token_hash)
values
  ('00000000-0000-4000-8000-000000000185', '00000000-0000-4000-8000-000000000183', repeat('c', 64)),
  ('00000000-0000-4000-8000-000000000186', '00000000-0000-4000-8000-000000000184', repeat('d', 64));

insert into public.customer_identity_providers (provider, issuer, audience)
values
  ('firebase', 'https://securetoken.google.com/foundation-memory-project', 'foundation-memory-project'),
  ('supabase', 'https://foundation-memory.supabase.co/auth/v1', 'authenticated');

insert into public.customer_firebase_principals (account_id, firebase_uid, status)
select id, 'foundation-memory-non-uuid', 'active'
from public.customer_accounts
where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000181';

select plan(32);

select has_column('public', 'customer_identity_ledger', 'account_id', 'identity ledger stores internal account ownership');
select has_column('public', 'customer_amis_links', 'account_id', 'AMIS links store internal account ownership');
select has_column('public', 'customer_memory_projections', 'account_id', 'memory projections store internal account ownership');

insert into public.customer_identity_ledger (
  visitor_id, session_id, user_id, identity_kind, identity_value_hash, source
) values (
  '00000000-0000-4000-8000-000000000183',
  '00000000-0000-4000-8000-000000000185',
  '00000000-0000-4000-8000-000000000181',
  'authenticated',
  repeat('e', 64),
  'foundation_test'
);

insert into public.customer_amis_links (id, user_id, amis_customer_id, state, method, evidence_category)
values
  ('00000000-0000-4000-8000-000000000187', '00000000-0000-4000-8000-000000000181', 'foundation-memory-a', 'active', 'trusted_migration', 'test'),
  ('00000000-0000-4000-8000-000000000188', '00000000-0000-4000-8000-000000000182', 'foundation-memory-b', 'active', 'trusted_migration', 'test');

insert into public.customer_memory_projections (
  link_id, user_id, memory, source_updated_at, projection_version
) values
  ('00000000-0000-4000-8000-000000000187', '00000000-0000-4000-8000-000000000181', '{"preferredRoomIds": ["room-a"]}', now(), 'foundation-test'),
  ('00000000-0000-4000-8000-000000000188', '00000000-0000-4000-8000-000000000182', '{"preferredRoomIds": ["room-b"]}', now(), 'foundation-test');

select is(
  (select account_id from public.customer_identity_ledger where identity_value_hash = repeat('e', 64)),
  (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000181'),
  'authenticated identity ledger rows backfill to the legacy account'
);
select is(
  (select account_id from public.customer_amis_links where id = '00000000-0000-4000-8000-000000000187'),
  (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000181'),
  'AMIS links backfill to the legacy account'
);
select is(
  (select account_id from public.customer_memory_projections where link_id = '00000000-0000-4000-8000-000000000187'),
  (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000181'),
  'memory projections backfill to the legacy account'
);
select is(
  (select count(*) from public.customer_identity_ledger where user_id is not null and account_id is null),
  0::bigint,
  'authenticated identity ledger rows have no orphaned account ownership'
);
select is(
  (select count(*) from public.customer_amis_links where account_id is null),
  0::bigint,
  'AMIS links have no orphaned account ownership'
);
select is(
  (select count(*) from public.customer_memory_projections where account_id is null),
  0::bigint,
  'memory projections have no orphaned account ownership'
);
select is(
  (select count(*) from public.customer_amis_links l join public.customer_accounts a on a.id = l.account_id where l.user_id is not null and a.legacy_supabase_user_id is distinct from l.user_id),
  0::bigint,
  'AMIS links preserve a consistent legacy overlap mapping'
);
select is(
  (select count(*) from public.customer_memory_projections p join public.customer_accounts a on a.id = p.account_id where p.user_id is not null and a.legacy_supabase_user_id is distinct from p.user_id),
  0::bigint,
  'memory projections preserve a consistent legacy overlap mapping'
);

select throws_ok(
  $$ update public.customer_amis_links set account_id = '00000000-0000-4000-8000-000000000182' where id = '00000000-0000-4000-8000-000000000187' $$,
  'P0001',
  'account ownership cannot be reassigned or detached',
  'AMIS links cannot be reassigned to another account'
);
select throws_ok(
  $$ update public.customer_memory_projections set account_id = '00000000-0000-4000-8000-000000000182' where link_id = '00000000-0000-4000-8000-000000000187' $$,
  'P0001',
  'account ownership cannot be reassigned or detached',
  'memory projections cannot be reassigned to another account'
);
select throws_ok(
  $$ update public.customer_identity_ledger set account_id = '00000000-0000-4000-8000-000000000182' where identity_value_hash = repeat('e', 64) $$,
  'P0001',
  'account ownership cannot be reassigned or detached',
  'identity ledger account ownership cannot be reassigned'
);
select throws_ok(
  $$ insert into public.customer_amis_links (id, user_id, account_id, amis_customer_id, state, method, evidence_category) values ('00000000-0000-4000-8000-000000000189', '00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000182', 'foundation-memory-poison', 'active', 'trusted_migration', 'test') $$,
  'P0001',
  'legacy owner and account ownership must match',
  'legacy overlap metadata cannot poison AMIS account ownership'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foundation-memory-non-uuid',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-memory-project',
    'aud', 'foundation-memory-project'
  )::text,
  true
);

select is((select current_customer_account_id()), '00000000-0000-4000-8000-000000000181'::uuid, 'non-UUID Firebase claim resolves to the internal account');
select is((select count(*) from public.customer_memory_projections), 1::bigint, 'mapped Firebase claim reads only its safe projection');
select is((select count(*) from public.customer_memory_projections where link_id = '00000000-0000-4000-8000-000000000188'), 0::bigint, 'mapped Firebase claim cannot read another account projection');
select throws_ok($$ select * from public.amis_customer_snapshots $$, '42501', null, 'browser cannot read raw AMIS snapshots');
select throws_ok($$ select * from public.customer_amis_links $$, '42501', null, 'browser cannot read AMIS links');
select throws_ok($$ select * from public.amis_sync_cursors $$, '42501', null, 'browser cannot read AMIS sync cursors');
select throws_ok($$ update public.customer_memory_projections set memory = '{}' $$, '42501', null, 'browser cannot write safe projections');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000181',
    'role', 'authenticated',
    'iss', 'https://foundation-memory.supabase.co/auth/v1',
    'aud', 'authenticated'
  )::text,
  true
);

select is((select current_customer_account_id()), '00000000-0000-4000-8000-000000000181'::uuid, 'strict legacy claim resolves to the same internal account');
select is((select count(*) from public.customer_memory_projections), 1::bigint, 'strict legacy claim reads the same safe projection');

select set_config('request.jwt.claims', 'malformed-claims', true);
select is((select count(*) from public.customer_memory_projections), 0::bigint, 'malformed claims cannot read safe projections');

reset role;
select ok(not has_table_privilege('anon', 'public.customer_memory_projections', 'select'), 'anon cannot read safe projections');
select ok(not has_table_privilege('authenticated', 'public.customer_amis_links', 'select'), 'authenticated has no AMIS link grant');
select ok(not has_table_privilege('authenticated', 'public.amis_sync_cursors', 'select'), 'authenticated has no sync cursor grant');
select ok(not has_function_privilege('anon', 'public.current_customer_account_id()', 'execute'), 'anon cannot execute account resolver');
select ok(has_function_privilege('authenticated', 'public.current_customer_account_id()', 'execute'), 'authenticated can execute account resolver');
select ok(not exists (
  select 1 from pg_attribute
  where attrelid = 'public.amis_customer_snapshots'::regclass and attname = 'email' and not attisdropped
), 'safe projections do not add raw email fields');
select ok(not exists (
  select 1 from pg_attribute
  where attrelid = 'public.amis_customer_snapshots'::regclass and attname in ('address', 'debt', 'notes') and not attisdropped
), 'safe projections do not add raw address, debt, or note fields');

select * from finish();
rollback;
