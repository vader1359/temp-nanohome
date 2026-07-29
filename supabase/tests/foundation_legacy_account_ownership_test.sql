begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  (:'authenticated_user_id', 'authenticated', 'authenticated', 'ownership-owner@example.test', '', now()),
  (:'other_user_id', 'authenticated', 'authenticated', 'ownership-other@example.test', '', now());

insert into public.carts (id, user_id)
values
  (:'cart_id_1'::uuid, :'authenticated_user_id'::uuid),
  (:'cart_id_2'::uuid, :'other_user_id'::uuid);

insert into public.orders (id, order_number, user_id, email, full_name, phone, address)
values
  (:'order_id_1'::uuid, 'FOUNDATION-OWN-1', :'authenticated_user_id'::uuid, 'owner@example.test', 'Owner', '0000000000', 'Foundation'),
  (:'order_id_2'::uuid, 'FOUNDATION-OWN-2', :'other_user_id'::uuid, 'other@example.test', 'Other', '0000000001', 'Foundation');

insert into public.products (id, name)
values ('00000000-0000-4000-8000-000000000021', 'Foundation cart product');

insert into public.variants (id, product_id, name)
values ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000021', 'Foundation cart variant');

select plan(38);

select is(
  (select account_id from public.carts where id = :'cart_id_1'::uuid),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'legacy cart is backfilled to the matching internal account'
);

select is(
  (select account_id from public.orders where id = :'order_id_1'::uuid),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'legacy order is backfilled to the matching internal account'
);

select is(
  (select account_id from public.profiles where id = :'authenticated_user_id'::uuid),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'legacy profile is backfilled to the matching internal account'
);

set local role postgres;

insert into public.customer_identity_providers (provider, issuer, audience)
values
  ('firebase', 'https://securetoken.google.com/foundation-ownership-project', 'foundation-ownership-project'),
  ('supabase', 'https://foundation-ownership.supabase.co/auth/v1', 'authenticated');

insert into public.customer_firebase_principals (account_id, firebase_uid, status, disabled_at)
select id, 'foundation-non-uuid-owner', 'active', null
from public.customer_accounts
where legacy_supabase_user_id = :'authenticated_user_id'::uuid;

insert into public.customer_accounts (id)
values ('00000000-0000-4000-8000-000000000101');

insert into public.customer_firebase_principals (account_id, firebase_uid, status, disabled_at)
values (
  '00000000-0000-4000-8000-000000000101',
  'foundation-disabled-principal',
  'disabled',
  now()
);

grant select, insert, update, delete on public.carts, public.cart_items, public.orders, public.profiles to authenticated;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foundation-non-uuid-owner',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-ownership-project',
    'aud', 'foundation-ownership-project'
  )::text,
  true
);

select is(
  (select count(*) from public.carts),
  1::bigint,
  'mapped Firebase principal reads only its account cart'
);

select is(
  (select count(*) from public.orders),
  1::bigint,
  'mapped Firebase principal reads only its account order'
);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'mapped Firebase principal reads only its account profile'
);

select is(
  (select count(*) from public.carts where id = :'cart_id_2'::uuid),
  0::bigint,
  'mapped Firebase principal cannot read another account cart'
);

select is(
  (select count(*) from public.orders where id = :'order_id_2'::uuid),
  0::bigint,
  'mapped Firebase principal cannot read another account order'
);

select is(
  (select count(*) from public.profiles where id = :'other_user_id'::uuid),
  0::bigint,
  'mapped Firebase principal cannot read another account profile'
);

select lives_ok(
  $proof$
    delete from public.carts
    where id = '00000000-0000-4000-8000-000000000071';
    insert into public.carts (id)
    values ('00000000-0000-4000-8000-000000000073');
  $proof$,
  'mapped non-UUID Firebase principal can create an account cart without a UUID cast'
);

select is(
  (select account_id from public.carts where id = '00000000-0000-4000-8000-000000000073'),
  :'authenticated_user_id'::uuid,
  'cart assignment derives the mapped Firebase account without accepting a browser claim'
);

select lives_ok(
  $proof$
    delete from public.carts
    where id = '00000000-0000-4000-8000-000000000073';
    insert into public.carts (id, account_id)
    values (
      '00000000-0000-4000-8000-000000000074',
      '00000000-0000-4000-8000-000000000061'
    );
  $proof$,
  'cart assignment preserves a valid Firebase account input'
);

select lives_ok(
  $$ insert into public.cart_items (id, cart_id, variant_id, quantity) values ('00000000-0000-4000-8000-000000000082', '00000000-0000-4000-8000-000000000074', '00000000-0000-4000-8000-000000000031', 1) $$,
  'mapped non-UUID Firebase principal can create an item in its cart'
);

select lives_ok(
  $$ update public.carts set merged_from_guest_id = 'foundation-merged' where id = '00000000-0000-4000-8000-000000000074' $$,
  'mapped non-UUID Firebase principal can update its cart'
);

select lives_ok(
  $$ update public.cart_items set quantity = 2 where id = '00000000-0000-4000-8000-000000000082' $$,
  'mapped non-UUID Firebase principal can update its cart item'
);

select is(
  (select quantity from public.cart_items where id = '00000000-0000-4000-8000-000000000082'),
  2,
  'mapped Firebase cart item update persists'
);

select throws_ok(
  $$ insert into public.cart_items (id, cart_id, variant_id, quantity) values ('00000000-0000-4000-8000-000000000083', '00000000-0000-4000-8000-000000000072', '00000000-0000-4000-8000-000000000031', 1) $$,
  '42501',
  null,
  'mapped Firebase principal cannot create an item in another account cart'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Firebase Owner' where id = '00000000-0000-4000-8000-000000000061' $$,
  'mapped non-UUID Firebase principal can update its legacy profile through account authority'
);

select is(
  (select full_name from public.profiles where id = :'authenticated_user_id'::uuid),
  'Firebase Owner',
  'mapped Firebase profile update persists'
);

select lives_ok(
  $$ delete from public.cart_items where id = '00000000-0000-4000-8000-000000000082' $$,
  'mapped non-UUID Firebase principal can delete its cart item'
);

select lives_ok(
  $$ delete from public.carts where id = '00000000-0000-4000-8000-000000000074' $$,
  'mapped non-UUID Firebase principal can delete its account cart'
);

select is(
  (select count(*) from public.carts where id = '00000000-0000-4000-8000-000000000074'),
  0::bigint,
  'mapped Firebase cart deletes persist'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foundation-non-uuid-owner',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/wrong-project',
    'aud', 'wrong-project'
  )::text,
  true
);

select is(
  (select count(*) from public.carts),
  0::bigint,
  'wrong Firebase issuer and audience cannot read carts'
);

select throws_ok(
  $$ insert into public.carts (id) values ('00000000-0000-4000-8000-000000000075') $$,
  '42501',
  null,
  'wrong Firebase issuer and audience cannot create carts'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foundation-unmapped-principal',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-ownership-project',
    'aud', 'foundation-ownership-project'
  )::text,
  true
);

select is(
  (select count(*) from public.carts),
  0::bigint,
  'unmapped Firebase principal cannot read carts'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foundation-disabled-principal',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-ownership-project',
    'aud', 'foundation-ownership-project'
  )::text,
  true
);

select is(
  (select count(*) from public.carts),
  0::bigint,
  'disabled Firebase principal cannot read carts'
);

select set_config('request.jwt.claims', 'malformed-claims', true);

select is(
  (select count(*) from public.carts),
  0::bigint,
  'malformed claims cannot read carts'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foundation-non-uuid-owner',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-ownership-project',
    'aud', 'foundation-ownership-project'
  )::text,
  true
);

select is(
  has_function_privilege('anon', 'public.current_customer_account_id()', 'execute'),
  false,
  'current account helper remains unavailable to anon'
);

select is(
  has_function_privilege('anon', 'public.current_legacy_supabase_user_id()', 'execute'),
  false,
  'legacy account helper remains unavailable to anon'
);

select is(
  has_function_privilege('anon', 'public.legacy_customer_account_id(uuid)', 'execute'),
  false,
  'legacy account lookup helper remains unavailable to anon'
);

select is(
  has_function_privilege('anon', 'public.is_legacy_account_ownership_valid(uuid, uuid)', 'execute'),
  false,
  'legacy ownership validator remains unavailable to anon'
);

set local role postgres;

select set_config('request.jwt.claims', '{}'::text, true);

insert into public.carts (id, user_id)
values (
  '00000000-0000-4000-8000-000000000071',
  '00000000-0000-4000-8000-000000000061'
);

insert into public.carts (id, guest_id)
values ('00000000-0000-4000-8000-000000000076', 'foundation-guest-cart');

set local role authenticated;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foundation-non-uuid-owner',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-ownership-project',
    'aud', 'foundation-ownership-project'
  )::text,
  true
);

select is(
  (select count(*) from public.carts where id = '00000000-0000-4000-8000-000000000076'),
  0::bigint,
  'guest carts remain outside authenticated account access'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'authenticated_user_id',
    'role', 'authenticated',
    'iss', 'https://foundation-ownership.supabase.co/auth/v1',
    'aud', 'authenticated'
  )::text,
  true
);

select is(
  (select count(*) from public.carts),
  1::bigint,
  'configured legacy Supabase principal retains cart access'
);

select is(
  (select count(*) from public.orders),
  1::bigint,
  'configured legacy Supabase principal retains order access'
);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'configured legacy Supabase principal retains profile access'
);

select lives_ok(
  $$ update public.carts set merged_from_guest_id = 'legacy-compatible' where id = '00000000-0000-4000-8000-000000000071' $$,
  'configured legacy Supabase principal retains compatible cart writes'
);

select throws_ok(
  $$ update public.carts set account_id = '00000000-0000-4000-8000-000000000062' where id = '00000000-0000-4000-8000-000000000071' $$,
  'P0001',
  null,
  'legacy principal cannot poison a cart account assignment'
);

select throws_ok(
  $$ update public.profiles set account_id = null where id = '00000000-0000-4000-8000-000000000061' $$,
  'P0001',
  null,
  'legacy principal cannot detach a profile account assignment'
);

select * from finish();

rollback;
