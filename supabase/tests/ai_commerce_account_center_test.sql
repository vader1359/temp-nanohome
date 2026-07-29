begin;

\ir fixtures.sql
\ir ../seed.sql

set local role postgres;

insert into public.customer_identity_providers (provider, issuer, audience)
values (
  'firebase',
  'https://securetoken.google.com/account-center-test',
  'account-center-test'
);

insert into public.customer_accounts (id)
values
  ('00000000-0000-4000-8000-000000000201'),
  ('00000000-0000-4000-8000-000000000202'),
  ('00000000-0000-4000-8000-000000000203');

insert into public.customer_firebase_principals (account_id, firebase_uid)
values
  ('00000000-0000-4000-8000-000000000201', 'firebase-account-center-owner'),
  ('00000000-0000-4000-8000-000000000202', 'firebase-account-center-other');

insert into public.customer_account_profiles (account_id, full_name)
values ('00000000-0000-4000-8000-000000000202', 'Other account');

insert into public.customer_wishlist_items (account_id, variant_id)
values ('00000000-0000-4000-8000-000000000202', :'variant_id_2'::uuid);

select plan(13);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'firebase-account-center-owner',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/account-center-test',
    'aud', 'account-center-test'
  )::text,
  true
);

select is(
  public.current_customer_account_id(),
  '00000000-0000-4000-8000-000000000201'::uuid,
  'Firebase claims resolve the exact internal account'
);

insert into public.customer_account_profiles (
  account_id, full_name, preferred_locale
) values (
  '00000000-0000-4000-8000-000000000201', 'Owner account', 'vi'
);

select is(
  (select full_name from public.customer_account_profiles),
  'Owner account',
  'the account can insert and read its own profile'
);

select is(
  (select count(*) from public.customer_account_profiles),
  1::bigint,
  'profile RLS hides every other account'
);

select is(
  (
    select count(*) from public.customer_account_profiles
    where account_id = '00000000-0000-4000-8000-000000000202'
  ),
  0::bigint,
  'a foreign profile ID returns no row'
);

select throws_ok(
  $$ insert into public.customer_account_profiles (account_id, full_name)
     values ('00000000-0000-4000-8000-000000000203', 'Forged') $$,
  '42501',
  null,
  'the account cannot insert a foreign profile'
);

update public.customer_account_profiles
set full_name = 'Owner updated'
where account_id = '00000000-0000-4000-8000-000000000201';

select is(
  (select full_name from public.customer_account_profiles),
  'Owner updated',
  'the account can update only its own editable profile'
);

insert into public.customer_wishlist_items (account_id, variant_id)
values ('00000000-0000-4000-8000-000000000201', :'variant_id_1'::uuid);

select is(
  (
    select count(*) from public.customer_wishlist_items
    where variant_id = :'variant_id_1'::uuid
  ),
  1::bigint,
  'the account can save its own catalog variant'
);

select is(
  (select count(*) from public.customer_wishlist_items),
  1::bigint,
  'wishlist RLS exposes only the current account rows'
);

select is(
  (
    select count(*) from public.customer_wishlist_items
    where variant_id = :'variant_id_2'::uuid
  ),
  0::bigint,
  'a foreign wishlist row is invisible'
);

select throws_ok(
  format(
    'insert into public.customer_wishlist_items (account_id, variant_id) values (%L, %L)',
    '00000000-0000-4000-8000-000000000202',
    :'variant_id_1'
  ),
  '42501',
  null,
  'the account cannot insert into another wishlist'
);

delete from public.customer_wishlist_items
where account_id = '00000000-0000-4000-8000-000000000201'
  and variant_id = :'variant_id_1'::uuid;

select is(
  (select count(*) from public.customer_wishlist_items),
  0::bigint,
  'the account can remove its own wishlist item'
);

select is(
  has_table_privilege(
    'authenticated',
    'public.customer_wishlist_merge_receipts',
    'select'
  ),
  false,
  'browser roles cannot read merge receipts'
);

select is(
  has_table_privilege('anon', 'public.customer_account_profiles', 'select'),
  false,
  'anonymous users cannot read account profiles'
);

select * from finish();
rollback;
