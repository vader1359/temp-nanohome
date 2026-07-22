begin;

select plan(30);
set local role service_role;

select lives_ok($$ insert into public.commerce_checkouts
  (id, owner_scope, web_order_id, idempotency_key, payload_hash)
  values ('00000000-0000-4000-8000-000000000101', 'guest:owner-01', 'WEB-raw-01', 'idem-raw-01', 'payload-raw-01') $$,
  'service role creates a checkout');
select is((select web_order_id from public.commerce_checkouts where id = '00000000-0000-4000-8000-000000000101'), 'WEB-raw-01', 'WEB order id is stored byte-exact');
select throws_ok($$ insert into public.commerce_checkouts (owner_scope, web_order_id, idempotency_key, payload_hash) values ('guest:owner-01', 'WEB-raw-01', 'idem-raw-02', 'payload-raw-02') $$, '23505', null, 'WEB order id is unique');
select throws_ok($$ insert into public.commerce_checkouts (owner_scope, web_order_id, idempotency_key, payload_hash) values ('guest:owner-01', 'WEB-raw-02', 'idem-raw-01', 'payload-raw-03') $$, '23505', null, 'idempotency key is unique for the owner');
select lives_ok($$ insert into public.commerce_checkouts (owner_scope, web_order_id, idempotency_key, payload_hash) values ('guest:owner-02', 'WEB-raw-02', 'idem-raw-01', 'payload-raw-04') $$, 'idempotency key is isolated by owner scope');
select throws_ok($$ insert into public.commerce_checkouts (owner_scope, web_order_id, idempotency_key, payload_hash) values ('guest:owner-01', 'ORD-raw-03', 'idem-raw-03', 'payload-raw-05') $$, '23514', null, 'WEB order id prefix is required');
select throws_ok($$ insert into public.commerce_checkouts (owner_scope, web_order_id, idempotency_key, payload_hash) values ('guest:owner-01', 'WEB-raw-04', '', 'payload-raw-06') $$, '23514', null, 'empty idempotency key is rejected');

select lives_ok($$ insert into public.commerce_inventory_holds
  (checkout_id, raw_sku, warehouse, quantity)
  values ('00000000-0000-4000-8000-000000000101', E' SKU\t01 ', E'WH\n01', 2) $$,
  'service role stores raw SKU and warehouse');
select is((select raw_sku from public.commerce_inventory_holds limit 1), E' SKU\t01 ', 'raw SKU bytes are preserved');
select is((select warehouse from public.commerce_inventory_holds limit 1), E'WH\n01', 'warehouse bytes are preserved');
select is((select expires_at - created_at from public.commerce_inventory_holds limit 1), interval '10 minutes', 'hold expiry is DB-owned at ten minutes');
insert into public.commerce_checkouts (id, owner_scope, web_order_id, idempotency_key, payload_hash)
  values ('00000000-0000-4000-8000-000000000102', 'guest:owner-01', 'WEB-raw-03', 'idem-raw-02', 'payload-raw-07');
select lives_ok($$ insert into public.commerce_inventory_holds (checkout_id, raw_sku, warehouse, quantity) values ('00000000-0000-4000-8000-000000000102', E' SKU\t01 ', E'WH\n01', 1) $$, 'multiple active SKU and warehouse holds are allowed');
select throws_ok($$ insert into public.commerce_inventory_holds (checkout_id, raw_sku, warehouse, quantity) values ('00000000-0000-4000-8000-000000000102', E' SKU\t01 ', E'WH\n01', 1) $$, '23505', null, 'duplicate hold identity is unique');
select throws_ok($$ insert into public.commerce_inventory_holds (checkout_id, raw_sku, warehouse, quantity) values ('00000000-0000-4000-8000-000000000101', '', 'WH-02', 1) $$, '23514', null, 'empty raw SKU is rejected');

select lives_ok($$ insert into public.commerce_payment_ledger
  (checkout_id, app_trans_id, zp_trans_id, amount, event, callback_digest)
  values ('00000000-0000-4000-8000-000000000101', 'app-01', 'zp-01', 100, 'captured', 'digest-01') $$,
  'service role appends payment event');
select throws_ok($$ insert into public.commerce_payment_ledger (checkout_id, app_trans_id, amount, event) values ('00000000-0000-4000-8000-000000000101', 'app-01', 100, 'captured') $$, '23505', null, 'app transaction id is unique');
select throws_ok($$ insert into public.commerce_payment_ledger (checkout_id, app_trans_id, zp_trans_id, amount, event) values ('00000000-0000-4000-8000-000000000101', 'app-02', 'zp-01', 100, 'captured') $$, '23505', null, 'ZaloPay transaction id is unique');
select throws_ok($$ insert into public.commerce_payment_ledger (checkout_id, app_trans_id, amount, event, callback_digest) values ('00000000-0000-4000-8000-000000000101', 'app-02', 100, 'captured', 'digest-01') $$, '23505', null, 'payment callback digest is unique');
select lives_ok($$ insert into public.commerce_refund_ledger
  (checkout_id, zp_trans_id, m_refund_id, amount, event, reason, actor, request_digest, callback_digest)
  values ('00000000-0000-4000-8000-000000000101', 'zp-01', 'refund-01', 100, 'completed', 'stock conflict', 'system', 'request-digest-01', 'refund-digest-01') $$,
  'service role appends refund event');
select throws_ok($$ insert into public.commerce_refund_ledger
  (checkout_id, zp_trans_id, m_refund_id, amount, event, reason, actor, request_digest)
  values ('00000000-0000-4000-8000-000000000101', 'zp-01', 'refund-01', 100, 'completed', 'stock conflict', 'system', 'request-digest-02') $$,
  '23505', null, 'refund id is unique');
select throws_ok($$ insert into public.commerce_refund_ledger
  (checkout_id, zp_trans_id, m_refund_id, amount, event, reason, actor, request_digest)
  values ('00000000-0000-4000-8000-000000000101', '', 'refund-02', 100, 'completed', 'stock conflict', 'system', 'request-digest-03') $$,
  '23514', null, 'empty original payment id is rejected');
select throws_ok($$ update public.commerce_payment_ledger set amount = 101 where app_trans_id = 'app-01' $$, 'P0001', 'commerce ledger is append-only', 'payment ledger rejects updates');
select throws_ok($$ delete from public.commerce_refund_ledger where m_refund_id = 'refund-01' $$, 'P0001', 'commerce ledger is append-only', 'refund ledger rejects deletes');

update public.commerce_inventory_holds set expires_at = now() - interval '1 second' where raw_sku = E' SKU\t01 ';
select is(public.commerce_expire_holds(), 1, 'expiry function expires due holds');
select is((select status from public.commerce_inventory_holds limit 1), 'expired', 'expired hold releases active uniqueness');
select lives_ok($$ insert into public.commerce_inventory_holds (checkout_id, raw_sku, warehouse, quantity) values ('00000000-0000-4000-8000-000000000101', E' SKU\t01 ', E'WH\n01', 1) $$, 'expired hold no longer blocks a new hold');

set local role authenticated;
select is((select count(*) from public.commerce_checkouts), 0::bigint, 'authenticated cannot read checkout ledger');
select throws_ok($$ insert into public.commerce_checkouts (owner_scope, web_order_id, idempotency_key, payload_hash) values ('guest:denied', 'WEB-denied', 'idem-denied', 'payload-denied') $$, '42501', null, 'authenticated cannot write checkout ledger');
select throws_ok($$ insert into public.commerce_payment_ledger (checkout_id, app_trans_id, amount, event) values ('00000000-0000-4000-8000-000000000101', 'app-denied', 1, 'failed') $$, '42501', null, 'authenticated cannot write payment ledger');
select ok(not has_function_privilege('public.commerce_expire_holds()', 'execute'), 'authenticated cannot execute expiry function');

select * from finish();
rollback;
