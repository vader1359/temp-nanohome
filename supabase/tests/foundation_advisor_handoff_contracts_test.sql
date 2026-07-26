begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  (:'authenticated_user_id', 'authenticated', 'authenticated', 'advisor-owner@example.test', '', now()),
  (:'other_user_id', 'authenticated', 'authenticated', 'advisor-other@example.test', '', now());

select id as auth_account_id from public.customer_accounts
where legacy_supabase_user_id = :'authenticated_user_id'::uuid \gset

insert into public.conversations (
  id, owner_id, owner_scope, locale, consent_version, consent_expires_at,
  conversation_storage_enabled, retention_expires_at, state, owner_account_id,
  guest_owner_scope_id, guest_owner_token_digest, guest_owner_scope_expires_at
) values (
  '00000000-0000-4000-8000-000000000711', :'authenticated_user_id'::uuid,
  'auth', 'en', 'test-v1', now() + interval '1 day', true,
  now() + interval '30 days', 'active', (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid),
  null, null, null
), (
  '00000000-0000-4000-8000-000000000712', null,
  'anon', 'en', 'test-v1', now() + interval '1 day', true,
  now() + interval '30 days', 'active', null,
  '00000000-0000-4000-8000-000000000731', repeat('c', 64), now() + interval '24 hours'
);

select plan(37);

select has_table('public', 'customer_advisor_handoffs', 'advisor handoffs table exists');
select has_table('public', 'customer_advisor_handoff_summaries', 'restricted handoff summaries table exists');
select has_table('public', 'customer_advisor_handoff_events', 'append-only handoff event table exists');
select has_table('public', 'customer_advisor_notification_outbox', 'redacted notification outbox exists');
select has_table('public', 'chat_attachment_intents', 'owner-scoped attachment intents table exists');
select has_table('public', 'chat_attachments', 'private attachment metadata table exists');
select has_view('public', 'customer_advisor_handoff_safe_status', 'owner-safe status view exists');

select is(
  (select count(*) from pg_constraint where conrelid = 'public.customer_advisor_handoffs'::regclass
    and conname = 'customer_advisor_handoffs_owner_scope_check'),
  1::bigint,
  'handoffs constrain account or opaque guest ownership'
);
select is(
  (select count(*) from pg_constraint where conrelid = 'public.chat_attachments'::regclass
    and conname = 'chat_attachments_private_object_path_check'),
  1::bigint,
  'attachments reject public object URLs'
);
select ok((select exists (
  select 1 from pg_trigger where tgrelid = 'public.customer_advisor_handoff_events'::regclass
    and tgname = 'customer_advisor_handoff_events_append_only' and not tgisinternal
)), 'handoff events carry an append-only trigger');
select is(
  (select count(*) from pg_attribute where attrelid = 'public.customer_advisor_notification_outbox'::regclass
    and attname in ('destination_adapter', 'response_digest', 'attempt_count', 'next_retry_at') and not attisdropped),
  4::bigint,
  'outbox stores delivery metadata and digest only');
select is(
  (select count(*) from pg_attribute where attrelid = 'public.customer_advisor_notification_outbox'::regclass
    and attname in ('payload', 'transcript', 'raw_content') and not attisdropped),
  0::bigint,
  'outbox schema has no raw payload or transcript column');

-- Happy paths are service-only writes for authenticated and opaque guest owners.
select lives_ok($$
  insert into public.customer_advisor_handoffs (
    id, public_reference, conversation_id, owner_scope, owner_account_id,
    reason_code, priority, status, restricted_contact_reference, first_response_due_at
  ) values (
    '00000000-0000-4000-8000-000000000721', 'ADVISOR-AUTH-1',
    '00000000-0000-4000-8000-000000000711', 'auth', (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid),
    'product_advice', 'normal', 'new', 'contact-ref-auth', now() + interval '4 hours'
  )
$$, 'authenticated account handoff records restricted contact by reference only');

select lives_ok($$
  insert into public.customer_advisor_handoffs (
    id, public_reference, conversation_id, owner_scope, guest_owner_scope_id,
    reason_code, priority, status, first_response_due_at
  ) values (
    '00000000-0000-4000-8000-000000000722', 'ADVISOR-GUEST-1',
    '00000000-0000-4000-8000-000000000712', 'anon', '00000000-0000-4000-8000-000000000731',
    'room_design', 'high', 'new', now() + interval '2 hours'
  )
$$, 'opaque guest handoff records its guest owner scope');

select lives_ok($$
  insert into public.customer_advisor_handoff_summaries (
    handoff_id, summary_version, safe_summary, last_message_id
  ) values (
    '00000000-0000-4000-8000-000000000721', 'advisor-summary-v1', 'Needs living-room advice', null
  )
$$, 'versioned safe summary records message references without transcript content');

select lives_ok($$
  insert into public.customer_advisor_handoff_events (
    handoff_id, event_type, from_status, to_status, actor_reference, safe_reason
  ) values (
    '00000000-0000-4000-8000-000000000721', 'assigned', 'new', 'assigned', 'advisor-1', 'advisor assigned'
  )
$$, 'legal handoff event transitions a handoff');

select lives_ok($$
  insert into public.chat_attachment_intents (
    id, conversation_id, owner_scope, owner_account_id, expected_mime_type, requested_at, expires_at
  ) values (
    '00000000-0000-4000-8000-000000000741', '00000000-0000-4000-8000-000000000711',
    'auth', (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid), 'image/jpeg', now(), now() + interval '24 hours'
  )
$$, 'authenticated owner can have a private attachment intent recorded by service');

select lives_ok($$
  insert into public.chat_attachments (
    id, intent_id, conversation_id, owner_scope, owner_account_id, object_path,
    mime_type, byte_size, sha256_digest, state, retention_expires_at
  ) values (
    '00000000-0000-4000-8000-000000000751', '00000000-0000-4000-8000-000000000741',
    '00000000-0000-4000-8000-000000000711', 'auth', (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid),
    'room-photos/auth/00000000-0000-4000-8000-000000000701/00000000-0000-4000-8000-000000000751/original.jpg',
    'image/jpeg', 1024, repeat('a', 64), 'active', now() + interval '30 days'
  )
$$, 'attachment metadata retains only a private object path and digest');

-- Dangerous: invalid transitions, retention, URLs, and immutable events are rejected.
select throws_ok($$
  insert into public.customer_advisor_handoff_events (
    handoff_id, event_type, from_status, to_status, actor_reference, safe_reason
  ) values (
    '00000000-0000-4000-8000-000000000721', 'status_changed', 'new', 'closed', 'advisor-1', 'forged close'
  )
$$, 'P0001', 'advisor handoff transition is not allowed', 'invalid handoff status transition is rejected');

select throws_ok($$
  insert into public.chat_attachment_intents (
    conversation_id, owner_scope, owner_account_id, expected_mime_type, requested_at, expires_at
  ) values (
    '00000000-0000-4000-8000-000000000711', 'auth', (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid),
    'image/png', now(), now() + interval '25 hours'
  )
$$, '23514', null, 'unconfirmed attachment intent cannot retain longer than 24 hours');

select throws_ok($$
  insert into public.chat_attachments (
    intent_id, conversation_id, owner_scope, owner_account_id, object_path, mime_type,
    byte_size, sha256_digest, state, retention_expires_at
  ) values (
    '00000000-0000-4000-8000-000000000741', '00000000-0000-4000-8000-000000000711',
    'auth', (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid),
    'https://cdn.example.test/public.jpg', 'image/jpeg',
    1024, repeat('b', 64), 'active', now() + interval '30 days'
  )
$$, '23514', null, 'public attachment object URL is rejected');

select throws_ok($$ update public.customer_advisor_handoff_events set safe_reason = 'forged' $$,
  'P0001', 'advisor handoff events are append-only', 'handoff events reject update');
select throws_ok($$ delete from public.customer_advisor_handoff_events $$,
  'P0001', 'advisor handoff events are append-only', 'handoff events reject delete');

-- Dangerous: browser roles cannot access restricted records or write contracts.
select is(has_table_privilege('authenticated', 'public.customer_advisor_handoffs', 'select'), false,
  'authenticated browser cannot read restricted handoff fields');
select is(has_table_privilege('authenticated', 'public.customer_advisor_handoff_summaries', 'select'), false,
  'authenticated browser cannot read handoff summaries');
select is(has_table_privilege('authenticated', 'public.customer_advisor_notification_outbox', 'select'), false,
  'authenticated browser cannot read notification metadata');
select is(has_table_privilege('authenticated', 'public.chat_attachments', 'select'), false,
  'authenticated browser cannot read private object metadata');
select is(has_table_privilege('anon', 'public.customer_advisor_handoffs', 'insert'), false,
  'guest browser cannot create a handoff directly');
select is(has_table_privilege('authenticated', 'public.customer_advisor_handoff_events', 'insert'), false,
  'authenticated browser cannot forge handoff events');
select is(has_table_privilege('service_role', 'public.customer_advisor_notification_outbox', 'select'), true,
  'service role can process the redacted notification outbox');

set local role anon;
select throws_ok($$ select 1 from public.customer_advisor_handoff_summaries $$,
  '42501', null, 'guest browser cannot read restricted handoff summaries');
select throws_ok($$ select 1 from public.chat_attachments $$,
  '42501', null, 'guest browser cannot read private attachment objects');
set local role postgres;

select is(
  (select count(*) from pg_class where relname in (
    'customer_advisor_handoffs', 'customer_advisor_handoff_summaries', 'customer_advisor_handoff_events',
    'customer_advisor_notification_outbox', 'chat_attachment_intents', 'chat_attachments'
  ) and relnamespace = 'public'::regnamespace and relrowsecurity),
  6::bigint,
  'every restricted handoff and attachment table enables row level security'
);
select is((select count(*) from public.customer_advisor_handoff_safe_status
  where public_reference = 'ADVISOR-AUTH-1'), 0::bigint,
  'safe status view does not reveal a handoff without an owner scope claim');

insert into public.customer_identity_providers (provider, issuer, audience)
values ('supabase', 'https://foundation.supabase.test/auth/v1', 'authenticated');

select set_config('request.jwt.claims', json_build_object(
  'sub', :'authenticated_user_id', 'role', 'authenticated',
  'iss', 'https://foundation.supabase.test/auth/v1', 'aud', 'authenticated'
)::text, true);
select is((select count(*) from public.customer_advisor_handoff_safe_status
  where public_reference = 'ADVISOR-AUTH-1'), 1::bigint,
  'authenticated owner can read their own safe handoff status');
select is((select count(*) from public.customer_advisor_handoff_safe_status
  where public_reference = 'ADVISOR-GUEST-1'), 0::bigint,
  'authenticated owner cannot read another guest safe status');
select set_config('request.jwt.claims', json_build_object(
  'role', 'anon', 'guest_owner_scope_id', '00000000-0000-4000-8000-000000000731'
)::text, true);
select is((select count(*) from public.customer_advisor_handoff_safe_status
  where public_reference = 'ADVISOR-GUEST-1'), 1::bigint,
  'guest scope can read only its safe handoff status');

select finish();
rollback;
