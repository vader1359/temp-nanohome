begin;

set local role postgres;

select plan(51);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_visitors'::regclass),
  'visitor table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_sessions'::regclass),
  'session table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_events'::regclass),
  'event table has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_consent_current'::regclass),
  'consent projection has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.customer_events', 'select'),
  'anon cannot read customer events'
);
select ok(
  not has_table_privilege('authenticated', 'public.customer_consent_current', 'select'),
  'authenticated cannot read current consent projection'
);
select ok(
  has_function_privilege('service_role', 'public.process_customer_subject_deletion(bigint, integer)', 'execute'),
  'service role can execute bounded deletion worker'
);
select ok(
  not has_function_privilege('anon', 'public.process_customer_subject_deletion(bigint, integer)', 'execute'),
  'anon cannot execute deletion worker'
);
select ok(
  has_function_privilege('service_role', 'public.append_customer_event(uuid, uuid, jsonb, timestamptz)', 'execute'),
  'service role can execute event RPC'
);
select ok(
  not has_function_privilege('anon', 'public.append_customer_event(uuid, uuid, jsonb, timestamptz)', 'execute'),
  'anon cannot execute event RPC'
);
select ok(
  position('extensions.digest' in pg_get_functiondef('public.append_customer_event(uuid, uuid, jsonb, timestamptz)'::regprocedure)) > 0,
  'event RPC schema-qualifies pgcrypto digest under its restricted search path'
);

insert into public.customer_visitors (id, visitor_token_hash)
values ('00000000-0000-4000-8000-000000000201', 'visitor-hash-only');
insert into public.customer_sessions (id, visitor_id, session_token_hash)
values ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000201', 'session-hash-only');

select lives_ok($$ insert into public.customer_consent_ledger
  (visitor_id, policy_version, locale, source, actor, analytics, withdrawal_reason)
  values ('00000000-0000-4000-8000-000000000201', 'v1', 'vi', 'banner', 'visitor', true, null) $$,
  'consent ledger accepts a complete append-only record'
);
select is((select analytics from public.customer_consent_current where visitor_id = '00000000-0000-4000-8000-000000000201'), true, 'current consent follows newest ledger record');
select is((select marketing from public.customer_consent_current where visitor_id = '00000000-0000-4000-8000-000000000201'), false, 'internal marketing projection defaults off');
select throws_ok($$ update public.customer_consent_ledger set analytics = false where visitor_id = '00000000-0000-4000-8000-000000000201' $$, 'P0001', 'customer ledgers are append-only', 'consent ledger rejects updates');
select throws_ok($$ delete from public.customer_consent_ledger where visitor_id = '00000000-0000-4000-8000-000000000201' $$, 'P0001', 'customer ledgers are append-only', 'consent ledger rejects deletes');

insert into public.customer_consent_ledger
  (visitor_id, session_id, policy_version, locale, source, actor, analytics, recorded_at)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', 'v0', 'vi', 'stale', 'visitor', false, now() - interval '1 day');
select is(
  (select consent_ledger_id from public.customer_consent_current where visitor_id = '00000000-0000-4000-8000-000000000201'),
  (select id from public.customer_consent_ledger where visitor_id = '00000000-0000-4000-8000-000000000201' and source = 'banner'),
  'stale consent ledger cannot replace newer projection'
);
select is((select analytics from public.customer_consent_current where visitor_id = '00000000-0000-4000-8000-000000000201'), true, 'stale consent does not change granted purpose');

select throws_ok($$ select public.append_customer_event('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000202', '{"name":"page_viewed","idempotencyKey":"bad","properties":{"routeKey":"/","locale":"vi"}}'::jsonb, now()) $$, 'P0001', 'visitor and session are inactive', 'event RPC rejects an invalid visitor and session pair');
select lives_ok($$ select public.append_customer_event('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"name":"page_viewed","idempotencyKey":"rpc-page","properties":{"routeKey":"/","locale":"vi"}}'::jsonb, now()) $$, 'event RPC accepts fixed columns with granted analytics');
select throws_ok($$ select public.append_customer_event('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"name":"recommendation_impression","idempotencyKey":"rpc-rec","properties":{"requestId":"r","placement":"home","itemIds":["00000000-0000-4000-8000-000000000031"]}}'::jsonb, now()) $$, 'P0001', 'required consent purpose is not granted', 'event RPC requires mapped personalization consent');
select throws_ok($$ select public.append_customer_event('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"name":"page_viewed","idempotencyKey":"rpc-raw","properties":{"routeKey":"/","locale":"vi","rawPayload":{}}}'::jsonb, now()) $$, 'P0001', 'unknown event properties are not allowed', 'event RPC rejects unknown properties');
select is((select count(*) from public.customer_events where idempotency_key_hash = encode(extensions.digest('rpc-page', 'sha256'), 'hex')), 1::bigint, 'event RPC stores one fixed-column record without payload');
select throws_ok($$ select public.append_customer_consent('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"version":"v3","withdrawn":true}'::jsonb) $$, 'P0001', 'withdrawal requires withdrawn true and a non-empty withdrawalReason', 'withdrawal requires a reason');
select throws_ok($$ select public.append_customer_consent('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"version":"v3","withdrawn":false,"withdrawalReason":"user request"}'::jsonb) $$, 'P0001', 'withdrawal requires withdrawn true and a non-empty withdrawalReason', 'withdrawal reason cannot imply withdrawal');
select lives_ok($$ select public.append_customer_consent('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"version":"v2","withdrawn":true,"withdrawalReason":"user request"}'::jsonb) $$, 'withdrawal appends consent and queues subject deletion');
select is((select count(*) from public.customer_subject_deletion_queue where visitor_id = '00000000-0000-4000-8000-000000000201' and processed_at is null), 1::bigint, 'withdrawal queue is subject-scoped and pending is idempotent');
select is((select revoked_at is not null from public.customer_visitors where id = '00000000-0000-4000-8000-000000000201'), true, 'withdrawal revokes the visitor identity');
select is((select revoked_at is not null from public.customer_sessions where id = '00000000-0000-4000-8000-000000000202'), true, 'withdrawal revokes the session identity');
select is((select status from public.resolve_customer_identity_v2('visitor-hash-only', 'session-hash-only')), 'inactive', 'identity resolution distinguishes revoked credentials');
select is((select status from public.bootstrap_customer_identity_v2('visitor-hash-only', 'session-hash-only')), 'inactive', 'bootstrap does not resurrect revoked credentials');
update public.customer_visitors set expires_at = now() where id = '00000000-0000-4000-8000-000000000201';
select is((select status from public.resolve_customer_identity_v2('visitor-hash-only', 'session-hash-only')), 'inactive', 'identity resolution treats expiry at now as inactive');
select is((select analytics or personalization or ai_processing or ai_conversation_storage or room_image_processing or room_image_storage or marketing from public.customer_consent_current where visitor_id = '00000000-0000-4000-8000-000000000201'), false, 'withdrawal turns every optional purpose off');
select is((select withdrawn_at is not null and withdrawal_reason = 'user request' from public.customer_consent_current where visitor_id = '00000000-0000-4000-8000-000000000201'), true, 'current consent records withdrawal');
select throws_ok($$ select public.append_customer_event('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"name":"cart_item_added","idempotencyKey":"rpc-cart","properties":{"variantId":"v1","sourcePlacement":"cart"}}'::jsonb, now()) $$, 'P0001', 'visitor and session are inactive', 'events reject revoked credentials after withdrawal');
select throws_ok($$ select public.append_customer_event('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"name":"cart_item_added","idempotencyKey":"rpc-after-withdrawal","properties":{"variantId":"v1","sourcePlacement":"cart"}}'::jsonb, now()) $$, 'P0001', 'visitor and session are inactive', 'event RPC rejects revoked identity');
select throws_ok($$ select public.append_customer_consent('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '{"version":"v3","analytics":true}'::jsonb) $$, 'P0001', 'visitor and session are inactive', 'consent RPC rejects revoked identity');

select lives_ok($$ insert into public.customer_events
  (visitor_id, session_id, event_name, idempotency_key_hash, occurred_at, route_key, locale)
  values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', 'page_viewed', 'event-hash', now(), '/', 'vi') $$,
  'allowlisted event accepts fixed typed columns'
);
select throws_ok($$ insert into public.customer_events
  (visitor_id, session_id, event_name, idempotency_key_hash, occurred_at)
  values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', 'unknown_event', 'other-hash', now()) $$, '23514', NULL, 'unknown event name is rejected');
select throws_ok($$ insert into public.customer_events
  (visitor_id, session_id, event_name, idempotency_key_hash, occurred_at, route_key, locale, arbitrary_payload)
  values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', 'page_viewed', 'third-hash', now(), '/', 'vi', '{}'::jsonb) $$, '42703', NULL, 'arbitrary client payload column does not exist');

select throws_ok($$ select public.process_customer_subject_deletion((select id from public.customer_subject_deletion_queue limit 1), 0) $$, 'P0001', 'p_batch_size must be between 1 and 1000', 'deletion worker rejects unbounded batch size');

set local role service_role;
select lives_ok($$ select public.process_customer_subject_deletion((select id from public.customer_subject_deletion_queue limit 1), 100) $$, 'worker deletes only customer subject data');
select is((select count(*) from public.customer_visitors where id = '00000000-0000-4000-8000-000000000201'), 0::bigint, 'customer visitor is deleted');
select is((select public.process_customer_subject_deletion((select id from public.customer_subject_deletion_queue limit 1), 100)), 0, 'deletion worker is idempotent for a deleted subject');
select is((select count(*) from public.customer_sessions where visitor_id = '00000000-0000-4000-8000-000000000201'), 0::bigint, 'subject sessions are deleted');
select is((select count(*) from public.customer_identity_ledger where visitor_id = '00000000-0000-4000-8000-000000000201'), 0::bigint, 'subject identity ledger is deleted');
select is((select count(*) from public.customer_consent_ledger where visitor_id = '00000000-0000-4000-8000-000000000201'), 0::bigint, 'subject consent ledger is deleted');
select is((select count(*) from public.customer_consent_current where visitor_id = '00000000-0000-4000-8000-000000000201'), 0::bigint, 'subject current consent is deleted');
select is((select count(*) from public.customer_events where visitor_id = '00000000-0000-4000-8000-000000000201'), 0::bigint, 'subject events are deleted');
select is((select count(*) from public.customer_subject_deletion_queue where visitor_id = '00000000-0000-4000-8000-000000000201'), 0::bigint, 'subject deletion queue entries are deleted');
select is((select count(*) from public.orders), 0::bigint, 'deletion primitive does not create or delete orders');

select * from finish();
rollback;
