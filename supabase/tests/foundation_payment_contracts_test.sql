begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (:'authenticated_user_id', 'authenticated', 'authenticated', 'payment-owner@example.test', '', now());

insert into public.orders (id, order_number, user_id, email, full_name, phone, address, subtotal)
values (
  :'order_id_1'::uuid, 'FOUNDATION-PAYMENT-1', :'authenticated_user_id'::uuid,
  'payment-owner@example.test', 'Payment Owner', '0000000000', 'Payment address', 100
);

-- Historical ZaloPay ledger rows must survive the provider-neutral migration.
insert into public.commerce_checkouts (
  id, web_order_id, owner_scope, idempotency_key, payload_hash, app_trans_id, zp_trans_id
) values (
  '00000000-0000-4000-8000-000000000301',
  'WEB-LEGACY-ZALO-1', 'auth', 'legacy-zalo-idem-1', repeat('a', 64),
  '260101_legacy_zalo_1', '260101999901'
);

insert into public.commerce_payment_ledger (checkout_id, app_trans_id, zp_trans_id, amount, event, callback_digest)
values ('00000000-0000-4000-8000-000000000301', '260101_legacy_zalo_1', '260101999901', 100, 'captured', repeat('b', 64));

insert into public.commerce_refund_ledger (checkout_id, zp_trans_id, m_refund_id, amount, event, reason, actor, request_digest)
values ('00000000-0000-4000-8000-000000000301', '260101999901', '260101_legacy_refund_1', 50, 'completed', 'legacy zalo refund', 'legacy-operator', repeat('c', 64));

select plan(41);

-- Provider-neutral contracts exist.

select has_table('public', 'payment_attempts', 'provider-neutral payment attempts table exists');
select has_table('public', 'payment_events', 'append-only payment events table exists');
select has_table('public', 'payment_reconciliations', 'payment reconciliations table exists');
select has_table('public', 'refund_operations', 'refund operations table exists');
select has_table('public', 'refund_events', 'append-only refund events table exists');

select is(
  (select count(*) from pg_constraint
   where conrelid = 'public.payment_attempts'::regclass
     and conname = 'payment_attempts_order_link_check'),
  1::bigint,
  'a payment attempt must link to an immutable order or checkout record'
);

select ok(
  (select not attnotnull from pg_attribute
   where attrelid = 'public.payment_attempts'::regclass and attname = 'legacy_app_trans_id'),
  'legacy ZaloPay identifiers stay nullable on provider-neutral attempts'
);

select ok(
  (select not attnotnull from pg_attribute
   where attrelid = 'public.payment_attempts'::regclass and attname = 'provider_transaction_id'),
  'provider transaction identifiers are never synthesized for historical rows'
);

select is(
  (select count(*) from pg_attribute
   where attrelid = 'public.payment_events'::regclass
     and attname in ('payload_digest', 'verification_decision', 'transition_decision')
     and not attisdropped),
  3::bigint,
  'payment events store digest-only evidence with verification and transition decisions'
);

select ok(
  (select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.payment_events'::regclass
      and tgname = 'payment_events_append_only'
      and not tgisinternal
  )),
  'payment events carry an append-only guard'
);

select ok(
  (select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.refund_events'::regclass
      and tgname = 'refund_events_append_only'
      and not tgisinternal
  )),
  'refund events carry an append-only guard'
);

select is(
  (select count(*) from pg_class
   where relname in ('payment_attempts', 'payment_events', 'payment_reconciliations',
                     'refund_operations', 'refund_events')
     and relnamespace = 'public'::regnamespace
     and relrowsecurity),
  5::bigint,
  'every payment contract table enables row level security'
);

select is(
  (select count(*) from pg_policy
   where polrelid in (
     'public.payment_attempts'::regclass,
     'public.payment_events'::regclass,
     'public.payment_reconciliations'::regclass,
     'public.refund_operations'::regclass,
     'public.refund_events'::regclass
   )),
  0::bigint,
  'service-only contracts expose no browser policy'
);

-- Happy path: attempt, verified event, reconciliation, manual refund.

select lives_ok(
  $$ insert into public.payment_attempts (
       id, order_id, provider, payment_method, merchant_reference, idempotency_key,
       amount, currency, state, request_digest, expires_at
     ) values (
       '00000000-0000-4000-8000-000000000401',
       '00000000-0000-4000-8000-000000000091',
       'sepay', 'bank_transfer', 'WEB-PAYMENT-1', 'payment-idem-1',
       100, 'VND', 'created', repeat('d', 64), now() + interval '30 minutes'
     ) $$,
  'a provider-neutral payment attempt records merchant and amount evidence'
);

select lives_ok(
  $$ insert into public.payment_events (
       attempt_id, provider, provider_event_id, event_type, from_state, to_state,
       verification_decision, transition_decision, payload_digest
     ) values (
       '00000000-0000-4000-8000-000000000401',
       'sepay', 'sepay-event-1', 'succeeded', 'created', 'succeeded',
       'verified', 'applied', repeat('e', 64)
     ) $$,
  'a verified provider event applies a legal payment transition'
);

select lives_ok(
  $$ insert into public.payment_reconciliations (
       attempt_id, provider_status, response_digest, decision
     ) values (
       '00000000-0000-4000-8000-000000000401', 'success', repeat('f', 64), 'match'
     ) $$,
  'reconciliation stores a safe provider status and a response digest'
);

select lives_ok(
  $$ insert into public.refund_operations (
       id, order_id, payment_attempt_id, method, state, amount, reason,
       idempotency_key, requested_by, approved_by, completed_by,
       bank_evidence_reference, bank_evidence_digest, approved_at, completed_at
     ) values (
       '00000000-0000-4000-8000-000000000501',
       '00000000-0000-4000-8000-000000000091',
       '00000000-0000-4000-8000-000000000401',
       'manual_bank_transfer', 'completed', 40, 'customer requested refund',
       'refund-idem-1', 'operator-a', 'operator-b', 'operator-b',
       'BANK-REF-1', repeat('1', 64), now(), now()
     ) $$,
  'a manual bank refund records two actors and digest-only bank evidence'
);

select lives_ok(
  $$ insert into public.refund_events (
       refund_operation_id, event_type, from_state, to_state,
       transition_decision, actor, payload_digest
     ) values (
       '00000000-0000-4000-8000-000000000501', 'completed', 'approved', 'completed',
       'applied', 'operator-b', repeat('2', 64)
     ) $$,
  'refund history is appended as an immutable event'
);

-- Dangerous: duplicate provider evidence and idempotency are constrained.

select throws_ok(
  $$ insert into public.payment_events (
       attempt_id, provider, provider_event_id, event_type, from_state, to_state,
       verification_decision, transition_decision, payload_digest
     ) values (
       '00000000-0000-4000-8000-000000000401',
       'sepay', 'sepay-event-1', 'succeeded', 'created', 'succeeded',
       'verified', 'ignored_duplicate', repeat('3', 64)
     ) $$,
  '23505',
  null,
  'a duplicate provider event id is rejected'
);

select throws_ok(
  $$ insert into public.payment_attempts (
       order_id, provider, payment_method, merchant_reference, idempotency_key, amount
     ) values (
       '00000000-0000-4000-8000-000000000091',
       'sepay', 'bank_transfer', 'WEB-PAYMENT-2', 'payment-idem-1', 100
     ) $$,
  '23505',
  null,
  'a replayed attempt idempotency key is rejected'
);

select throws_ok(
  $$ insert into public.payment_attempts (
       order_id, provider, payment_method, merchant_reference, idempotency_key, amount
     ) values (
       '00000000-0000-4000-8000-000000000091',
       'sepay', 'bank_transfer', 'WEB-PAYMENT-1', 'payment-idem-2', 100
     ) $$,
  '23505',
  null,
  'a duplicate merchant reference per provider is rejected'
);

-- Dangerous: invalid transitions and invalid amounts.

select throws_ok(
  $$ insert into public.payment_events (
       attempt_id, provider, provider_event_id, event_type, from_state, to_state,
       verification_decision, transition_decision, payload_digest
     ) values (
       '00000000-0000-4000-8000-000000000401',
       'sepay', 'sepay-event-2', 'authorized', 'succeeded', 'authorized',
       'verified', 'applied', repeat('4', 64)
     ) $$,
  'P0001',
  'payment transition is not allowed',
  'an applied event cannot move a settled attempt backwards'
);

select throws_ok(
  $$ insert into public.payment_attempts (
       order_id, provider, payment_method, merchant_reference, idempotency_key, amount
     ) values (
       '00000000-0000-4000-8000-000000000091',
       'sepay', 'bank_transfer', 'WEB-PAYMENT-3', 'payment-idem-3', 0
     ) $$,
  '23514',
  null,
  'a zero payment amount is rejected'
);

select throws_ok(
  $$ insert into public.refund_operations (
       order_id, method, state, amount, reason, idempotency_key, requested_by
     ) values (
       '00000000-0000-4000-8000-000000000091',
       'manual_bank_transfer', 'completed', 10, 'single actor refund',
       'refund-idem-2', 'operator-a'
     ) $$,
  '23514',
  null,
  'a manual refund cannot complete without a distinct second actor'
);

-- Dangerous: payment and refund events reject update and delete.

select throws_ok(
  $$ update public.payment_events set verification_decision = 'unverified' $$,
  'P0001',
  'payment ledger is append-only',
  'payment events reject update'
);

select throws_ok(
  $$ delete from public.payment_events $$,
  'P0001',
  'payment ledger is append-only',
  'payment events reject delete'
);

select throws_ok(
  $$ update public.refund_events set actor = 'forged-operator' $$,
  'P0001',
  'payment ledger is append-only',
  'refund events reject update'
);

select throws_ok(
  $$ delete from public.refund_events $$,
  'P0001',
  'payment ledger is append-only',
  'refund events reject delete'
);

-- Dangerous: fabricated provider history is rejected.

select throws_ok(
  $$ insert into public.payment_attempts (
       order_id, provider, payment_method, merchant_reference, idempotency_key,
       amount, legacy_app_trans_id, legacy_zp_trans_id
     ) values (
       '00000000-0000-4000-8000-000000000091',
       'sepay', 'bank_transfer', 'WEB-PAYMENT-4', 'payment-idem-4',
       100, '260101_legacy_zalo_1', '260101999901'
     ) $$,
  '23514',
  null,
  'a SePay attempt cannot claim historical ZaloPay identifiers'
);

select throws_ok(
  $$ insert into public.payment_events (
       attempt_id, provider, provider_event_id, event_type, from_state, to_state,
       verification_decision, transition_decision, payload_digest
     ) values (
       '00000000-0000-4000-8000-000000000401',
       'zalopay', 'zalopay-event-1', 'succeeded', 'created', 'succeeded',
       'verified', 'applied', repeat('5', 64)
     ) $$,
  'P0001',
  'payment event provider must match the payment attempt provider',
  'a fabricated cross-provider event is rejected'
);

-- Dangerous: browser roles have no access to payment contracts.

select is(
  has_table_privilege('anon', 'public.payment_attempts', 'select'),
  false,
  'anon cannot read payment attempts'
);

select is(
  has_table_privilege('authenticated', 'public.payment_events', 'select'),
  false,
  'authenticated browser role cannot read payment events'
);

select is(
  has_table_privilege('authenticated', 'public.payment_events', 'insert'),
  false,
  'authenticated browser role cannot forge payment events'
);

select is(
  has_table_privilege('anon', 'public.refund_operations', 'insert'),
  false,
  'anon cannot request refunds directly'
);

select is(
  has_table_privilege('service_role', 'public.payment_attempts', 'select'),
  true,
  'the service role retains payment contract access'
);

set local role anon;

select throws_ok(
  $$ select 1 from public.payment_attempts $$,
  '42501',
  null,
  'a browser role select on payment attempts is denied'
);

set local role postgres;

-- Historical ZaloPay ledgers are untouched.

select is(
  (select count(*) from public.commerce_payment_ledger
   where app_trans_id = '260101_legacy_zalo_1' and zp_trans_id = '260101999901' and amount = 100),
  1::bigint,
  'the historical ZaloPay payment ledger row is unchanged'
);

select is(
  (select count(*) from public.commerce_refund_ledger
   where m_refund_id = '260101_legacy_refund_1' and zp_trans_id = '260101999901' and amount = 50),
  1::bigint,
  'the historical ZaloPay refund ledger row is unchanged'
);

select is(
  (select count(*) from pg_trigger
   where tgrelid = 'public.commerce_payment_ledger'::regclass and not tgisinternal),
  1::bigint,
  'no new trigger is attached to the historical ZaloPay payment ledger'
);

select is(
  (select count(*) from pg_attribute
   where attrelid = 'public.commerce_refund_ledger'::regclass
     and attnum > 0 and not attisdropped),
  13::bigint,
  'the historical ZaloPay refund ledger keeps its original column set'
);

-- Digest-only evidence: no raw provider payload column is stored.

select is(
  (select count(*) from pg_attribute
   where attrelid in (
     'public.payment_events'::regclass,
     'public.payment_reconciliations'::regclass,
     'public.refund_events'::regclass
   )
     and attnum > 0 and not attisdropped
     and atttypid = 'jsonb'::regtype),
  0::bigint,
  'no payment evidence table stores a raw provider payload'
);

select * from finish();
rollback;
