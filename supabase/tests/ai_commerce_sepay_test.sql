begin;

\ir fixtures.sql
\ir ../seed.sql

set local role postgres;

insert into public.amis_inventory_baselines (id, completed_at, is_active)
values ('00000000-0000-4000-8000-000000000501', now(), true);
insert into public.amis_inventory_baseline_lines (baseline_id, sku, stock)
select
  '00000000-0000-4000-8000-000000000501',
  variant.sku,
  case when variant.id = :'variant_id_1'::uuid then 3 else 0 end
from public.variants variant
where variant.sku is not null;
insert into public.amis_inventory_sync_state (sync_key, active_baseline_id)
values ('inventory', '00000000-0000-4000-8000-000000000501');

update public.variants
set stock = case when id = :'variant_id_1'::uuid then 3 else 0 end,
    source_updated_at = null,
    packshot_url = case
      when id = :'variant_id_1'::uuid then 'https://cdn.example.test/sepay-cart.jpg'
      else packshot_url
    end
where id in (:'variant_id_1'::uuid, :'variant_id_2'::uuid);

insert into public.customer_accounts (id)
values
  ('00000000-0000-4000-8000-000000000511'),
  ('00000000-0000-4000-8000-000000000512');

select plan(33);

select is(
  has_function_privilege(
    'authenticated',
    'public.capture_customer_account_order(uuid,text,text,text,text,text,text,text,text,text,text)',
    'execute'
  ),
  false,
  'browser roles cannot execute account order capture'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.create_customer_sepay_test_attempt(uuid,uuid,text)',
    'execute'
  ),
  false,
  'browser roles cannot create payment attempts'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.apply_sepay_test_ipn(text,text,text,bigint,text,timestamptz)',
    'execute'
  ),
  false,
  'browser roles cannot apply payment truth'
);
select is(
  has_table_privilege('anon', 'public.payment_attempts', 'select'),
  false,
  'anonymous callers cannot read payment attempts'
);

set local role service_role;

select results_eq(
  $$
    select *
    from public.mutate_customer_account_cart(
      '00000000-0000-4000-8000-000000000511',
      '00000000-0000-4000-8000-000000000031',
      2,
      0,
      'add'
    )
  $$,
  $$ values ('updated'::text, 1::bigint) $$,
  'checkout begins from a bounded server-owned account cart'
);

create temporary table captured_sepay_order as
select *
from public.capture_customer_account_order(
  '00000000-0000-4000-8000-000000000511',
  '00000000-0000-4000-8000-000000000521',
  repeat('a', 64),
  'Sanitized Test',
  'customer@example.test',
  '0900000000',
  '1 Test Street',
  null,
  null,
  null,
  null
);

select is(
  (select replayed from captured_sepay_order),
  false,
  'first checkout capture is not a replay'
);
select is(
  (select amount from captured_sepay_order),
  (
    select eligibility.price * 2
    from public.catalog_eligibility eligibility
    where eligibility.variant_id = :'variant_id_1'::uuid
  ),
  'checkout amount comes from current server catalog price'
);
select is(
  (
    select count(*)
    from public.orders customer_order
    where customer_order.id = (select order_id from captured_sepay_order)
      and customer_order.account_id = '00000000-0000-4000-8000-000000000511'
      and customer_order.owner_scope = 'auth'
      and customer_order.order_kind = 'paid_order'
      and customer_order.payment_status = 'unpaid'
  ),
  1::bigint,
  'captured order is exact-account owned and remains unpaid'
);
select is(
  (
    select count(*)
    from public.cart_items item
    join public.carts cart on cart.id = item.cart_id
    where cart.account_id = '00000000-0000-4000-8000-000000000511'
  ),
  0::bigint,
  'captured cart lines are cleared after immutable order snapshots are stored'
);
select is(
  (
    select cart.version
    from public.carts cart
    where cart.account_id = '00000000-0000-4000-8000-000000000511'
  ),
  2::bigint,
  'order capture advances the cart version'
);

create temporary table replayed_sepay_order as
select *
from public.capture_customer_account_order(
  '00000000-0000-4000-8000-000000000511',
  '00000000-0000-4000-8000-000000000521',
  repeat('a', 64),
  'Sanitized Test',
  'customer@example.test',
  '0900000000',
  '1 Test Street',
  null,
  null,
  null,
  null
);

select is(
  (select replayed from replayed_sepay_order),
  true,
  'same checkout idempotency key and digest returns the first order'
);
select is(
  (select order_id from replayed_sepay_order),
  (select order_id from captured_sepay_order),
  'idempotent checkout replay never creates a second order'
);
select throws_ok(
  $$
    select *
    from public.capture_customer_account_order(
      '00000000-0000-4000-8000-000000000511',
      '00000000-0000-4000-8000-000000000521',
      repeat('b', 64),
      'Changed Test',
      'customer@example.test',
      '0900000000',
      '1 Test Street',
      null,
      null,
      null,
      null
    )
  $$,
  'P0001',
  'checkout_idempotency_conflict',
  'mismatched checkout replay is rejected'
);

create temporary table first_sepay_attempt as
select *
from public.create_customer_sepay_test_attempt(
  '00000000-0000-4000-8000-000000000511',
  (select order_id from captured_sepay_order),
  '00000000-0000-4000-8000-000000000521'
);

select is(
  (select created from first_sepay_attempt),
  true,
  'first SePay Test initiation creates one attempt'
);
select is(
  (select attempt_state from first_sepay_attempt),
  'pending',
  'browser initiation leaves payment pending'
);
select is(
  (
    select attempt.provider_environment
    from public.payment_attempts attempt
    where attempt.id = (select attempt_id from first_sepay_attempt)
  ),
  'sandbox',
  'the attempt is explicitly bound to SePay sandbox'
);
select is(
  (
    select attempt.provider_checkout_url
    from public.payment_attempts attempt
    where attempt.id = (select attempt_id from first_sepay_attempt)
  ),
  'https://vietqr.app/img',
  'the attempt exposes only the server-owned Test Mode VietQR URL'
);

select matches(
  (select merchant_reference from first_sepay_attempt),
  '^WEB[A-Z0-9]{12}$',
  'the payment attempt uses the VCB-compatible WEB plus 12 alphanumeric code'
);

create temporary table replayed_sepay_attempt as
select *
from public.create_customer_sepay_test_attempt(
  '00000000-0000-4000-8000-000000000511',
  (select order_id from captured_sepay_order),
  '00000000-0000-4000-8000-000000000521'
);

select is(
  (select created from replayed_sepay_attempt),
  false,
  'payment initiation retry returns the durable attempt'
);
select is(
  (select attempt_id from replayed_sepay_attempt),
  (select attempt_id from first_sepay_attempt),
  'payment initiation cannot create duplicate attempts'
);

select is(
  public.apply_sepay_test_ipn(
    (select merchant_reference from first_sepay_attempt),
    'event-wrong-amount',
    'transaction-wrong-amount',
    1,
    repeat('c', 64),
    now()
  ),
  'not_found',
  'wrong amount cannot resolve or mutate the expected payment'
);
select is(
  (
    select customer_order.payment_status
    from public.orders customer_order
    where customer_order.id = (select order_id from captured_sepay_order)
  ),
  'unpaid',
  'wrong amount leaves the order unpaid'
);

select is(
  public.apply_sepay_test_ipn(
    (select merchant_reference from first_sepay_attempt),
    'event-valid-001',
    'transaction-valid-001',
    (select amount::bigint from first_sepay_attempt),
    repeat('d', 64),
    now()
  ),
  'applied',
  'first verified SePay Test IPN applies payment truth'
);
select is(
  (
    select customer_order.payment_status
    from public.orders customer_order
    where customer_order.id = (select order_id from captured_sepay_order)
  ),
  'paid',
  'only the verified IPN marks the order paid'
);
select is(
  (
    select attempt.state
    from public.payment_attempts attempt
    where attempt.id = (select attempt_id from first_sepay_attempt)
  ),
  'succeeded',
  'verified IPN advances the attempt monotonically'
);
select is(
  (
    select event.payload_digest
    from public.payment_events event
    where event.provider_event_id = 'sandbox:event-valid-001'
  ),
  repeat('d', 64),
  'payment ledger stores only the payload digest'
);

select is(
  public.apply_sepay_test_ipn(
    (select merchant_reference from first_sepay_attempt),
    'event-valid-001',
    'transaction-valid-001',
    (select amount::bigint from first_sepay_attempt),
    repeat('d', 64),
    now()
  ),
  'duplicate',
  'exact webhook retry is idempotent'
);
select is(
  (
    select count(*)
    from public.payment_events event
    where event.attempt_id = (select attempt_id from first_sepay_attempt)
  ),
  1::bigint,
  'exact retry does not append another event'
);
select is(
  public.apply_sepay_test_ipn(
    (select merchant_reference from first_sepay_attempt),
    'event-valid-002',
    'transaction-valid-001',
    (select amount::bigint from first_sepay_attempt),
    repeat('e', 64),
    now()
  ),
  'duplicate',
  'a second event ID for the same provider transaction cannot fulfill twice'
);
select is(
  (
    select count(*)
    from public.payment_events event
    where event.attempt_id = (select attempt_id from first_sepay_attempt)
      and event.transition_decision = 'ignored_duplicate'
  ),
  1::bigint,
  'same-transaction replay is recorded as ignored duplicate'
);
select is(
  public.apply_sepay_test_ipn(
    (select merchant_reference from first_sepay_attempt),
    'event-conflict-001',
    'transaction-conflict-001',
    (select amount::bigint from first_sepay_attempt),
    repeat('f', 64),
    now()
  ),
  'conflict',
  'a second distinct transfer for a paid order is quarantined as conflict'
);
select is(
  (
    select customer_order.payment_status
    from public.orders customer_order
    where customer_order.id = (select order_id from captured_sepay_order)
  ),
  'paid',
  'conflict cannot reverse or double-apply payment truth'
);

select throws_ok(
  format(
    'select * from public.create_customer_sepay_test_attempt(%L, %L, %L)',
    '00000000-0000-4000-8000-000000000512',
    (select order_id::text from captured_sepay_order),
    '00000000-0000-4000-8000-000000000522'
  ),
  'P0001',
  'sepay_test_order_not_found',
  'another account cannot initiate payment for the order'
);

select * from finish();
rollback;
