begin;

\ir fixtures.sql
\ir ../seed.sql

set local role postgres;

insert into public.amis_inventory_baselines (id, completed_at, is_active)
values ('00000000-0000-4000-8000-000000000301', now(), true);
insert into public.amis_inventory_baseline_lines (baseline_id, sku, stock)
select
  '00000000-0000-4000-8000-000000000301',
  variant.sku,
  case when variant.id = :'variant_id_1'::uuid then 3 else 0 end
from public.variants variant
where variant.sku is not null;
insert into public.amis_inventory_sync_state (sync_key, active_baseline_id)
values ('inventory', '00000000-0000-4000-8000-000000000301');

update public.variants
set stock = case when id = :'variant_id_1'::uuid then 3 else 0 end,
    source_updated_at = null,
    packshot_url = case
      when id = :'variant_id_1'::uuid then 'https://cdn.example.test/cart-variant.jpg'
      else packshot_url
    end
where id in (:'variant_id_1'::uuid, :'variant_id_2'::uuid);

insert into public.customer_identity_providers (provider, issuer, audience)
values (
  'firebase',
  'https://securetoken.google.com/account-cart-test',
  'account-cart-test'
);
insert into public.customer_accounts (id)
values
  ('00000000-0000-4000-8000-000000000311'),
  ('00000000-0000-4000-8000-000000000312');
insert into public.customer_firebase_principals (account_id, firebase_uid)
values
  ('00000000-0000-4000-8000-000000000311', 'firebase-cart-owner'),
  ('00000000-0000-4000-8000-000000000312', 'firebase-cart-other');

create temporary table account_cart_merge_result (result jsonb not null);
grant select, insert on account_cart_merge_result to service_role;

select plan(21);

select is(
  has_function_privilege(
    'authenticated',
    'public.mutate_customer_account_cart(uuid,uuid,integer,bigint,text)',
    'execute'
  ),
  false,
  'browser roles cannot execute the privileged cart mutation function'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.merge_customer_guest_cart(uuid,text,jsonb)',
    'execute'
  ),
  false,
  'browser roles cannot execute the privileged guest merge function'
);
select is(
  has_table_privilege(
    'authenticated',
    'public.customer_cart_merge_receipts',
    'select'
  ),
  false,
  'browser roles cannot inspect merge receipts'
);

set local role service_role;

select results_eq(
  $$
    select *
    from public.mutate_customer_account_cart(
      '00000000-0000-4000-8000-000000000311',
      '00000000-0000-4000-8000-000000000031',
      2,
      0,
      'add'
    )
  $$,
  $$ values ('updated'::text, 1::bigint) $$,
  'an eligible add creates the exact account cart at version one'
);

set local role postgres;
select is(
  (
    select item.quantity
    from public.cart_items item
    join public.carts cart on cart.id = item.cart_id
    where cart.account_id = '00000000-0000-4000-8000-000000000311'
      and item.variant_id = :'variant_id_1'::uuid
  ),
  2,
  'the account cart stores only the server-validated quantity'
);

set local role service_role;
select results_eq(
  $$
    select *
    from public.mutate_customer_account_cart(
      '00000000-0000-4000-8000-000000000311',
      '00000000-0000-4000-8000-000000000031',
      3,
      0,
      'update'
    )
  $$,
  $$ values ('version_conflict'::text, 1::bigint) $$,
  'a stale mutation returns the current version without replay'
);
select results_eq(
  $$
    select *
    from public.mutate_customer_account_cart(
      '00000000-0000-4000-8000-000000000311',
      '00000000-0000-4000-8000-000000000031',
      2,
      1,
      'add'
    )
  $$,
  $$ values ('unavailable'::text, 1::bigint) $$,
  'an add above current stock fails closed'
);
select results_eq(
  $$
    select *
    from public.mutate_customer_account_cart(
      '00000000-0000-4000-8000-000000000311',
      '00000000-0000-4000-8000-000000000031',
      3,
      1,
      'update'
    )
  $$,
  $$ values ('updated'::text, 2::bigint) $$,
  'an update at the current stock boundary succeeds'
);
select results_eq(
  $$
    select *
    from public.mutate_customer_account_cart(
      '00000000-0000-4000-8000-000000000311',
      '00000000-0000-4000-8000-000000000032',
      1,
      2,
      'add'
    )
  $$,
  $$ values ('unavailable'::text, 2::bigint) $$,
  'an unavailable catalog variant cannot enter the cart'
);
select results_eq(
  $$
    select *
    from public.mutate_customer_account_cart(
      '00000000-0000-4000-8000-000000000311',
      '00000000-0000-4000-8000-000000000031',
      null,
      2,
      'remove'
    )
  $$,
  $$ values ('updated'::text, 3::bigint) $$,
  'remove advances the cart version exactly once'
);
select results_eq(
  $$
    select *
    from public.mutate_customer_account_cart(
      '00000000-0000-4000-8000-000000000311',
      '00000000-0000-4000-8000-000000000031',
      null,
      3,
      'remove'
    )
  $$,
  $$ values ('updated'::text, 3::bigint) $$,
  'removing an absent line is a stable no-op'
);

do $setup$
begin
  perform *
  from public.mutate_customer_account_cart(
    '00000000-0000-4000-8000-000000000311',
    '00000000-0000-4000-8000-000000000031',
    1,
    3,
    'add'
  );
end;
$setup$;

insert into account_cart_merge_result (result)
select public.merge_customer_guest_cart(
  '00000000-0000-4000-8000-000000000311',
  'merge-account-cart-001',
  jsonb_build_array(
    jsonb_build_object('variantId', :'variant_id_1', 'quantity', 1),
    jsonb_build_object('variantId', :'variant_id_1', 'quantity', 2),
    jsonb_build_object('variantId', :'variant_id_2', 'quantity', 1)
  )
);

select is(
  (select result ->> 'changedLines' from account_cart_merge_result),
  '1',
  'guest merge reports the changed canonical line'
);
select is(
  (select result ->> 'removedLines' from account_cart_merge_result),
  '1',
  'guest merge reports unavailable lines removed from input'
);
select is(
  (select result ->> 'version' from account_cart_merge_result),
  '5',
  'guest merge advances version once for all accepted lines'
);

set local role postgres;
select is(
  (
    select item.quantity
    from public.cart_items item
    join public.carts cart on cart.id = item.cart_id
    where cart.account_id = '00000000-0000-4000-8000-000000000311'
      and item.variant_id = :'variant_id_1'::uuid
  ),
  3,
  'duplicate guest variants are canonicalized and capped at current stock'
);

set local role service_role;
select is(
  public.merge_customer_guest_cart(
    '00000000-0000-4000-8000-000000000311',
    'merge-account-cart-001',
    jsonb_build_array(
      jsonb_build_object('variantId', :'variant_id_1', 'quantity', 1)
    )
  ),
  (select result from account_cart_merge_result),
  'replaying the account-scoped idempotency key returns the first result'
);

set local role postgres;
select is(
  (
    select cart.version
    from public.carts cart
    where cart.account_id = '00000000-0000-4000-8000-000000000311'
  ),
  5::bigint,
  'idempotent replay does not mutate the cart'
);
select throws_ok(
  format(
    'insert into public.cart_items (cart_id, variant_id, quantity)
     select id, %L, 11 from public.carts where account_id = %L',
    :'variant_id_2',
    '00000000-0000-4000-8000-000000000311'
  ),
  '23514',
  null,
  'new cart writes cannot exceed the quantity bound'
);

insert into public.carts (account_id)
values ('00000000-0000-4000-8000-000000000312');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'firebase-cart-owner',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/account-cart-test',
    'aud', 'account-cart-test'
  )::text,
  true
);
select is(
  (select count(*) from public.carts),
  1::bigint,
  'cart RLS exposes only the current Firebase account cart'
);
select is(
  (
    select count(*)
    from public.carts
    where account_id = '00000000-0000-4000-8000-000000000312'
  ),
  0::bigint,
  'a foreign cart identifier returns no rows'
);
select throws_ok(
  $$
    insert into public.carts (account_id)
    values ('00000000-0000-4000-8000-000000000312')
  $$,
  '42501',
  null,
  'a browser cannot create a cart for another account'
);

select * from finish();
rollback;
