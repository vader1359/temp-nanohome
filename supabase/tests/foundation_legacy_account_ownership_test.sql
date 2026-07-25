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

select plan(12);

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

insert into public.customer_firebase_principals (account_id, firebase_uid)
select id, 'foundation-non-uuid-owner'
from public.customer_accounts
where legacy_supabase_user_id = :'authenticated_user_id'::uuid;

grant select on public.carts, public.orders, public.profiles to authenticated;

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

select * from finish();

rollback;
