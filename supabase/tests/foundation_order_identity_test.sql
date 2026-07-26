begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  (:'authenticated_user_id', 'authenticated', 'authenticated', 'order-owner@example.test', '', now()),
  (:'other_user_id', 'authenticated', 'authenticated', 'order-other@example.test', '', now());

insert into public.customer_identity_providers (provider, issuer, audience)
values
  ('firebase', 'https://securetoken.google.com/foundation-orders', 'foundation-orders'),
  ('supabase', 'https://foundation-orders.supabase.co/auth/v1', 'authenticated');

insert into public.customer_firebase_principals (account_id, firebase_uid, status)
select id, 'foundation-order-firebase-owner', 'active'
from public.customer_accounts
where legacy_supabase_user_id = :'authenticated_user_id'::uuid;

insert into public.customer_firebase_principals (account_id, firebase_uid, status)
select id, 'foundation-order-firebase-other', 'active'
from public.customer_accounts
where legacy_supabase_user_id = :'other_user_id'::uuid;

insert into public.products (id, name)
values ('00000000-0000-4000-8000-000000000021', 'Foundation order product');

insert into public.variants (id, product_id, name, sku, price, in_stock)
values
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000021', 'Order variant A', 'ORD-A', 10, true),
  ('00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000021', 'Order variant B', 'ORD-B', 20, true);

insert into public.carts (id, user_id)
values (:'cart_id_1'::uuid, :'authenticated_user_id'::uuid);

insert into public.cart_items (id, cart_id, variant_id, quantity)
values (:'cart_item_id_1'::uuid, :'cart_id_1'::uuid, '00000000-0000-4000-8000-000000000031', 2);

insert into public.orders (id, order_number, user_id, email, full_name, phone, address, subtotal)
values
  (:'order_id_1'::uuid, 'FOUNDATION-ORDER-1', :'authenticated_user_id'::uuid, 'owner@example.test', 'Owner', '0000000000', 'Owner address', 10),
  (:'order_id_2'::uuid, 'FOUNDATION-ORDER-2', :'other_user_id'::uuid, 'other@example.test', 'Other', '0000000001', 'Other address', 20);

insert into public.orders (
  id, order_number, email, full_name, phone, address, subtotal,
  owner_scope, guest_owner_id, guest_owner_token_digest, guest_owner_token_expires_at
) values (
  :'guest_order_id'::uuid, 'FOUNDATION-ORDER-GUEST', 'guest@example.test', 'Guest', '0000000002', 'Guest address', 30,
  'guest',
  '00000000-0000-4000-8000-000000000201',
  encode(extensions.digest('foundation-guest-order-token', 'sha256'), 'hex'),
  now() + interval '1 hour'
);

insert into public.order_items (order_id, variant_id, product_name, variant_name, sku, price, quantity)
values (:'order_id_1'::uuid, '00000000-0000-4000-8000-000000000031', 'Owner product', 'Owner variant', 'ORD-A', 10, 1);

insert into public.order_status_history (order_id, status, changed_by)
values (:'order_id_1'::uuid, 'pending', :'authenticated_user_id'::uuid);

select plan(43);

-- Schema: immutable owner scope, order kind, idempotency, snapshot, status axes.

select ok(
  (select attnotnull from pg_attribute
   where attrelid = 'public.orders'::regclass and attname = 'owner_scope'),
  'orders require an explicit server-owned owner scope'
);

select ok(
  (select attnotnull from pg_attribute
   where attrelid = 'public.orders'::regclass and attname = 'web_order_number'),
  'orders carry a required human-facing WEB order number'
);

select ok(
  (select attnotnull from pg_attribute
   where attrelid = 'public.orders'::regclass and attname = 'email'),
  'orders.email stays non-null pending external SePay and AMIS proof'
);

select is(
  (select count(*) from pg_constraint
   where conrelid = 'public.orders'::regclass
     and conname in (
       'orders_business_status_check',
       'orders_inventory_status_check',
       'orders_amis_export_status_check',
       'orders_payment_status_check',
       'orders_fulfillment_status_check',
       'orders_refund_status_check'
     )),
  6::bigint,
  'orders expose six independent Plan 02 status axes'
);

select ok(
  (select exists (select 1 from pg_constraint
   where conrelid = 'public.orders'::regclass and conname = 'orders_order_kind_check')),
  'orders classify quote requests separately from paid orders'
);

select ok(
  (select exists (select 1 from pg_index
   where indexrelid = 'public.orders_account_idempotency_key_unique'::regclass)),
  'authenticated checkout idempotency is unique per account'
);

select ok(
  (select exists (select 1 from pg_index
   where indexrelid = 'public.orders_guest_idempotency_key_unique'::regclass)),
  'guest checkout idempotency is unique per opaque guest owner'
);

select ok(
  (select exists (select 1 from pg_attribute
   where attrelid = 'public.orders'::regclass and attname = 'price_snapshot' and attnotnull)),
  'orders retain a required server price snapshot'
);

select is(
  (select count(*) from pg_attribute
   where attrelid = 'public.orders'::regclass
     and attname in ('user_id', 'order_number', 'status', 'subtotal')
     and not attisdropped),
  4::bigint,
  'legacy overlap columns are retained'
);

-- Legacy rows remain readable and are classified by server-owned scope.

select is(
  (select owner_scope from public.orders where id = :'order_id_1'::uuid),
  'auth',
  'legacy authenticated order backfills to the auth owner scope'
);

select is(
  (select owner_scope from public.orders where id = :'guest_order_id'::uuid),
  'guest',
  'ownerless legacy order backfills to the guest owner scope'
);

select is(
  (select count(*) from public.orders where web_order_number is null),
  0::bigint,
  'every legacy order receives a WEB order number'
);

select is(
  (select account_id from public.orders where id = :'order_id_1'::uuid),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'legacy authenticated order still resolves to its internal account'
);

select is(
  (select actor_kind from public.order_status_history where order_id = :'order_id_1'::uuid),
  'account',
  'legacy status history actor is reclassified as an account actor'
);

select is(
  (select actor_account_id from public.order_status_history where order_id = :'order_id_1'::uuid),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'legacy status history actor derives the internal account id'
);

-- Owner scope and identity are immutable.

select throws_ok(
  $$ update public.orders set owner_scope = 'guest' where id = '00000000-0000-4000-8000-000000000091' $$,
  'P0001',
  'order owner scope and identity cannot be reassigned',
  'owner scope cannot be reassigned'
);

select throws_ok(
  $$ update public.orders set guest_owner_id = gen_random_uuid() where id = '00000000-0000-4000-8000-000000000093' $$,
  'P0001',
  'order owner scope and identity cannot be reassigned',
  'guest owner id cannot be reassigned'
);

select throws_ok(
  $$ update public.orders set web_order_number = 'WEB-FORGED' where id = '00000000-0000-4000-8000-000000000091' $$,
  'P0001',
  'order owner scope and identity cannot be reassigned',
  'WEB order number cannot be rewritten'
);

-- Shape constraints reject mixed and unbound ownership.

select throws_ok(
  $$ insert into public.orders (order_number, email, full_name, phone, address, owner_scope, guest_owner_id)
     values ('FOUNDATION-MIXED', 'mixed@example.test', 'Mixed', '1', 'Mixed address', 'auth', gen_random_uuid()) $$,
  '23514',
  null,
  'authenticated scope cannot carry guest ownership evidence'
);

select throws_ok(
  $$ insert into public.orders (order_number, email, full_name, phone, address, owner_scope, guest_owner_id, guest_owner_token_digest, guest_owner_token_expires_at)
     values ('FOUNDATION-WEAK-DIGEST', 'weak@example.test', 'Weak', '1', 'Weak address', 'guest', gen_random_uuid(), 'not-a-digest', now() + interval '1 hour') $$,
  '23514',
  null,
  'guest ownership requires an exact opaque token digest shape'
);

select throws_ok(
  $$ insert into public.orders (order_number, email, full_name, phone, address, owner_scope, user_id)
     values ('FOUNDATION-GUEST-AUTH', 'guestauth@example.test', 'GuestAuth', '1', 'Address', 'guest', '00000000-0000-4000-8000-000000000061') $$,
  '23514',
  null,
  'guest scope cannot claim an authenticated owner'
);

-- Guest access requires opaque owner-bound token evidence.

select is(
  public.verify_order_guest_scope(
    :'guest_order_id'::uuid,
    '00000000-0000-4000-8000-000000000201',
    'foundation-guest-order-token'
  ),
  :'guest_order_id'::uuid,
  'exact guest owner id and token resolve the guest order'
);

select is(
  public.verify_order_guest_scope(
    :'guest_order_id'::uuid,
    '00000000-0000-4000-8000-000000000201',
    'forged-guest-order-token'
  ),
  null::uuid,
  'forged guest token is rejected'
);

select is(
  public.verify_order_guest_scope(
    :'guest_order_id'::uuid,
    '00000000-0000-4000-8000-000000000202',
    'foundation-guest-order-token'
  ),
  null::uuid,
  'valid token bound to another guest owner id is rejected'
);

select is(
  public.verify_order_guest_scope(
    :'order_id_1'::uuid,
    '00000000-0000-4000-8000-000000000201',
    'foundation-guest-order-token'
  ),
  null::uuid,
  'guest evidence cannot unlock an account-owned order'
);

-- Order number, email, and phone are not authorization keys.

select is(
  (select count(*) from pg_policy
   where polrelid = 'public.orders'::regclass
     and polname = 'Guests can select order by order number setting'),
  0::bigint,
  'order number alone no longer authorizes an order read'
);

select is(
  (select count(*) from pg_policy
   where polrelid = 'public.order_items'::regclass
     and polname = 'Guests can select items by order number setting'),
  0::bigint,
  'order number alone no longer authorizes an order item read'
);

select is(
  (select count(*) from pg_policy
   where polrelid = 'public.orders'::regclass
     and polname = 'Users and guests can insert orders'),
  0::bigint,
  'browser roles have no direct order insert policy'
);

select is(
  has_table_privilege('anon', 'public.orders', 'insert'),
  false,
  'anon cannot insert orders'
);

select is(
  has_table_privilege('authenticated', 'public.orders', 'update'),
  false,
  'authenticated browser role cannot update orders'
);

select is(
  has_function_privilege('anon', 'public.verify_order_guest_scope(uuid, uuid, text)', 'execute'),
  false,
  'anon cannot probe guest order ownership'
);

-- Server price, paid state, discount, and provider evidence stay server-owned.

select is(
  has_table_privilege('authenticated', 'public.order_items', 'insert'),
  false,
  'authenticated browser role cannot insert order line prices'
);

select is(
  has_table_privilege('authenticated', 'public.order_status_history', 'insert'),
  false,
  'authenticated browser role cannot forge order status transitions'
);

select is(
  has_table_privilege('anon', 'public.order_status_history', 'insert'),
  false,
  'anon cannot forge order status transitions'
);

select ok(
  (select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.orders'::regclass
      and tgname = 'prevent_order_identity_mutation'
      and not tgisinternal
  )),
  'orders carry a server-side tamper guard on update'
);

select ok(
  (select not prosecdef from pg_proc
   where oid = 'public.prevent_order_identity_mutation()'::regprocedure),
  'the tamper guard runs as invoker so it observes the real browser role'
);

select is(
  (select count(*) from pg_policy
   where polrelid = 'public.orders'::regclass and polcmd in ('a', 'w', 'd')),
  0::bigint,
  'no browser write policy remains on orders'
);

-- Firebase cart-to-order capture must not cast a non-UUID subject.

grant select on public.carts, public.cart_items, public.orders to authenticated;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'foundation-order-firebase-owner',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-orders',
    'aud', 'foundation-orders'
  )::text,
  true
);

select lives_ok(
  $$ select public.capture_order_from_cart('Firebase Owner', 'firebase-owner@example.test', '0000000003', 'Firebase address') $$,
  'non-UUID Firebase subject captures a cart without a cast error'
);

set local role postgres;

select is(
  (select account_id from public.orders where order_number like 'ORD-%'),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'Firebase checkout creates an account-owned order'
);

select is(
  (select owner_scope from public.orders where order_number like 'ORD-%'),
  'auth',
  'Firebase checkout order uses the authenticated owner scope'
);

select is(
  (select grand_total from public.orders where order_number like 'ORD-%'),
  20::numeric,
  'checkout derives the grand total from persisted server prices'
);

select is(
  (select jsonb_array_length(price_snapshot) from public.orders where order_number like 'ORD-%'),
  1,
  'checkout stores a server price snapshot for every captured line'
);

select is(
  (select actor_kind from public.order_status_history
   where order_id = (select id from public.orders where order_number like 'ORD-%')),
  'account',
  'checkout status history records an internal account actor'
);

select * from finish();
rollback;
