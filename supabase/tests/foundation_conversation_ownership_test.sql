begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  (:'authenticated_user_id', 'authenticated', 'authenticated', 'conversation-owner@example.test', '', now()),
  (:'other_user_id', 'authenticated', 'authenticated', 'conversation-other@example.test', '', now());

insert into public.customer_identity_providers (provider, issuer, audience)
values
  ('firebase', 'https://securetoken.google.com/foundation-conversations', 'foundation-conversations'),
  ('supabase', 'https://foundation-conversations.supabase.co/auth/v1', 'authenticated');

insert into public.customer_firebase_principals (account_id, firebase_uid, status)
select id, 'foundation-conversation-firebase-owner', 'active'
from public.customer_accounts
where legacy_supabase_user_id = :'authenticated_user_id'::uuid;

insert into public.customer_accounts (id, state)
values ('00000000-0000-4000-8000-000000000701', 'disabled');

insert into public.customer_firebase_principals (account_id, firebase_uid, status, disabled_at)
values ('00000000-0000-4000-8000-000000000701', 'foundation-conversation-disabled', 'disabled', now());

insert into public.conversations (
  id, owner_id, owner_scope, locale, consent_version, consent_expires_at,
  conversation_storage_enabled, retention_expires_at, guest_owner_scope_id,
  guest_owner_token_digest, guest_owner_scope_expires_at, created_at
) values
  ('00000000-0000-4000-8000-000000000711', :'authenticated_user_id'::uuid, 'auth', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days', null, null, null, now()),
  ('00000000-0000-4000-8000-000000000712', :'other_user_id'::uuid, 'auth', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days', null, null, null, now()),
  ('00000000-0000-4000-8000-000000000713', null, 'anon', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days', '00000000-0000-4000-8000-000000000721', encode(extensions.digest('guest-token-one', 'sha256'), 'hex'), now() + interval '1 day', now()),
  ('00000000-0000-4000-8000-000000000714', null, 'anon', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days', '00000000-0000-4000-8000-000000000722', encode(extensions.digest('guest-token-two', 'sha256'), 'hex'), now() - interval '1 second', now() - interval '1 day');

insert into public.chat_messages (
  id, conversation_id, role, content, expires_at, message_ref, content_blocks
) values
  ('00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000711', 'user', 'Account owner message.', now() + interval '30 days', 'turn-1', '[{"kind":"text","text":"Account owner message."}]'),
  ('00000000-0000-4000-8000-000000000732', '00000000-0000-4000-8000-000000000713', 'user', 'Guest owner message.', now() + interval '30 days', 'turn-1', '[{"kind":"text","text":"Guest owner message."}]');

select plan(40);

select is(
  (select owner_account_id from public.conversations where id = '00000000-0000-4000-8000-000000000711'),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'authenticated legacy conversation backfills to its internal account'
);

select is(
  (select count(*) from public.conversations where owner_scope = 'auth' and owner_account_id is null),
  0::bigint,
  'authenticated conversations have no ownership orphans'
);

select is(
  (select count(*) from public.conversations where owner_scope = 'anon' and owner_account_id is not null),
  0::bigint,
  'anonymous history is not converted into account ownership'
);

select ok(
  (select owner_id from public.conversations where id = '00000000-0000-4000-8000-000000000711') = :'authenticated_user_id'::uuid,
  'legacy owner_id remains overlap metadata'
);

select is(
  public.verify_conversation_guest_scope('00000000-0000-4000-8000-000000000713', 'guest-token-one'),
  '00000000-0000-4000-8000-000000000721'::uuid,
  'server verifier resolves the exact active guest scope'
);

select is(
  public.verify_conversation_guest_scope('00000000-0000-4000-8000-000000000713', 'guest-token-two'),
  null::uuid,
  'guest token cannot be replayed against another conversation'
);

select is(
  public.verify_conversation_guest_scope('00000000-0000-4000-8000-000000000713', 'forged-token'),
  null::uuid,
  'forged guest token cannot resolve a scope'
);

select is(
  public.verify_conversation_guest_scope('00000000-0000-4000-8000-000000000714', 'guest-token-two'),
  null::uuid,
  'expired guest scope cannot resolve'
);

select is(
  public.verify_conversation_guest_scope('00000000-0000-4000-8000-000000000713', null),
  null::uuid,
  'null guest token cannot resolve a scope'
);

select throws_ok(
  $$ insert into public.conversations (id, owner_id, owner_scope, locale, consent_version, consent_expires_at, conversation_storage_enabled, retention_expires_at, guest_owner_scope_id, guest_owner_token_digest, guest_owner_scope_expires_at, created_at) values ('00000000-0000-4000-8000-000000000715', null, 'anon', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days', '00000000-0000-4000-8000-000000000725', 'not-a-digest', now() + interval '1 day', now()) $$,
  '23514', null,
  'new guest scope digest must be a SHA-256 hex digest'
);

select throws_ok(
  $$ update public.conversations set guest_owner_scope_id = '00000000-0000-4000-8000-000000000723' where id = '00000000-0000-4000-8000-000000000713' $$,
  'P0001', 'guest conversation ownership cannot be changed',
  'assigned guest scope UUID cannot be replaced with a valid-looking scope'
);

select throws_ok(
  $$ update public.conversations set guest_owner_token_digest = encode(extensions.digest('guest-token-replacement', 'sha256'), 'hex') where id = '00000000-0000-4000-8000-000000000713' $$,
  'P0001', 'guest conversation ownership cannot be changed',
  'assigned guest scope digest cannot be replaced with a valid-looking digest'
);

select throws_ok(
  $$ update public.conversations set guest_owner_scope_expires_at = now() + interval '2 days' where id = '00000000-0000-4000-8000-000000000713' $$,
  'P0001', 'guest conversation ownership cannot be changed',
  'assigned guest scope expiry cannot be replaced with a valid-looking expiry'
);

select throws_ok(
  $$ update public.conversations set guest_owner_scope_id = null, guest_owner_token_digest = null, guest_owner_scope_expires_at = null where id = '00000000-0000-4000-8000-000000000713' $$,
  'P0001', 'guest conversation ownership cannot be changed',
  'assigned guest ownership cannot be detached'
);

select throws_ok(
  $$ update public.conversations set owner_scope = 'auth', owner_id = '00000000-0000-4000-8000-000000000061', guest_owner_scope_id = null, guest_owner_token_digest = null, guest_owner_scope_expires_at = null where id = '00000000-0000-4000-8000-000000000713' $$,
  'P0001', 'guest conversation ownership cannot be changed',
  'guest ownership cannot convert to authenticated ownership'
);

select throws_ok(
  $$ update public.conversations set owner_scope = 'anon', owner_id = null, owner_account_id = null, guest_owner_scope_id = '00000000-0000-4000-8000-000000000724', guest_owner_token_digest = encode(extensions.digest('auth-to-guest-token', 'sha256'), 'hex'), guest_owner_scope_expires_at = now() + interval '2 days' where id = '00000000-0000-4000-8000-000000000711' $$,
  'P0001', 'authenticated conversation ownership cannot be changed',
  'authenticated ownership cannot convert to guest ownership'
);

select lives_ok(
  $$ update public.conversations set locale = 'vi' where id = '00000000-0000-4000-8000-000000000713' $$,
  'non-ownership conversation metadata remains mutable'
);

select throws_ok(
  $$ insert into public.chat_messages (conversation_id, role, content, expires_at, message_ref, content_blocks) values ('00000000-0000-4000-8000-000000000711', 'user', 'Duplicate idempotency key.', now() + interval '1 day', 'turn-1', '[]') $$,
  '23505', null,
  'message reference is idempotent within a conversation'
);

select lives_ok(
  $$ insert into public.chat_messages (conversation_id, role, content, expires_at, message_ref, content_blocks) values ('00000000-0000-4000-8000-000000000712', 'user', 'Same reference for another conversation.', now() + interval '1 day', 'turn-1', '[]') $$,
  'message reference may repeat in another conversation'
);

select throws_ok(
  $$ insert into public.chat_messages (conversation_id, role, content, expires_at, message_ref, content_blocks) values ('00000000-0000-4000-8000-000000000711', 'user', 'Bad blocks.', now() + interval '1 day', 'bad-blocks', '{}') $$,
  '23514', null,
  'structured message blocks must be an array'
);

select ok(
  (select jsonb_typeof(content_blocks) = 'array' from public.chat_messages where id = '00000000-0000-4000-8000-000000000731'),
  'structured message blocks are persisted'
);

select lives_ok(
  $$ insert into public.chat_answer_evidence (message_id, model_version, prompt_version) values ('00000000-0000-4000-8000-000000000731', 'model-v1', 'prompt-v1') $$,
  'server can persist evidence for the owned message'
);

select lives_ok(
  $$ select public.delete_verified_guest_conversation('00000000-0000-4000-8000-000000000713', 'guest-token-one') $$,
  'server can delete an active guest conversation through verified scope'
);

select is(
  (select state from public.conversations where id = '00000000-0000-4000-8000-000000000713'),
  'deleted',
  'verified guest deletion retains the deletion state'
);

select is(
  public.verify_conversation_guest_scope('00000000-0000-4000-8000-000000000713', 'guest-token-one'),
  null::uuid,
  'deleted guest conversation cannot resolve'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'foundation-conversation-firebase-owner', 'role', 'authenticated', 'iss', 'https://securetoken.google.com/foundation-conversations', 'aud', 'foundation-conversations')::text, true);

select is(
  public.current_customer_account_id(),
  :'authenticated_user_id'::uuid,
  'mapped non-UUID Firebase subject resolves its internal account without a cast'
);

select ok(not has_table_privilege('authenticated', 'public.conversations', 'select'), 'browser authenticated role cannot directly read conversations');
select ok(not has_table_privilege('authenticated', 'public.chat_messages', 'select'), 'browser authenticated role cannot directly read transcripts');
select ok(not has_table_privilege('authenticated', 'public.chat_answer_evidence', 'select'), 'browser authenticated role cannot directly read evidence');
select ok(not has_table_privilege('authenticated', 'public.chat_messages', 'insert'), 'browser authenticated role cannot directly append messages');

select throws_ok(
  $$ select * from public.chat_messages $$,
  '42501', null,
  'browser authenticated role is denied full transcript retrieval'
);

select throws_ok(
  $$ insert into public.chat_messages (conversation_id, role, content, expires_at) values ('00000000-0000-4000-8000-000000000712', 'user', 'Cross-account message.', now() + interval '1 day') $$,
  '42501', null,
  'browser Firebase owner cannot write another account message'
);

select is(
  has_function_privilege('authenticated', 'public.verify_conversation_guest_scope(uuid, text)', 'execute'),
  false,
  'guest scope verifier is unavailable to browser authenticated role'
);

select is(
  has_function_privilege('anon', 'public.verify_conversation_guest_scope(uuid, text)', 'execute'),
  false,
  'guest scope verifier is unavailable to anon'
);

select is(
  has_function_privilege('authenticated', 'public.delete_verified_guest_conversation(uuid, text)', 'execute'),
  false,
  'guest deletion helper is unavailable to browser authenticated role'
);

select set_config('request.jwt.claims', json_build_object('sub', :'authenticated_user_id', 'role', 'authenticated', 'iss', 'https://foundation-conversations.supabase.co/auth/v1', 'aud', 'authenticated')::text, true);

select is(
  public.current_customer_account_id(),
  :'authenticated_user_id'::uuid,
  'legacy Supabase subject resolves the same internal account'
);

select set_config('request.jwt.claims', json_build_object('sub', 'foundation-conversation-firebase-owner', 'role', 'authenticated', 'iss', 'https://securetoken.google.com/wrong', 'aud', 'wrong')::text, true);
select is(public.current_customer_account_id(), null::uuid, 'wrong Firebase issuer and audience cannot resolve an account');

select set_config('request.jwt.claims', json_build_object('sub', 'unmapped-conversation-principal', 'role', 'authenticated', 'iss', 'https://securetoken.google.com/foundation-conversations', 'aud', 'foundation-conversations')::text, true);
select is(public.current_customer_account_id(), null::uuid, 'unmapped Firebase subject cannot resolve an account');

select set_config('request.jwt.claims', json_build_object('sub', 'foundation-conversation-disabled', 'role', 'authenticated', 'iss', 'https://securetoken.google.com/foundation-conversations', 'aud', 'foundation-conversations')::text, true);
select is(public.current_customer_account_id(), null::uuid, 'disabled Firebase subject cannot resolve an account');

select set_config('request.jwt.claims', 'malformed-claims', true);
select is(public.current_customer_account_id(), null::uuid, 'malformed claims cannot resolve an account');

select * from finish();
rollback;
