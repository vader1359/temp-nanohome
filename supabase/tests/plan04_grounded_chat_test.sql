begin;

set local role postgres;
select plan(47);

select ok((select relrowsecurity from pg_class where oid = 'public.ai_sources'::regclass), 'sources have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_chunks'::regclass), 'chunks have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.conversations'::regclass), 'conversations have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.chat_messages'::regclass), 'messages have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.chat_answer_evidence'::regclass), 'answer evidence has RLS enabled');
select ok((select count(*) from pg_constraint where conrelid = 'public.ai_sources'::regclass and contype = 'u' and conkey = array[
  (select attnum from pg_attribute where attrelid = 'public.ai_sources'::regclass and attname = 'id'),
  (select attnum from pg_attribute where attrelid = 'public.ai_sources'::regclass and attname = 'locale')
]::smallint[]) = 1, 'sources have the composite key required by chunk locale foreign keys');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name in ('ai_sources', 'ai_chunks', 'conversations', 'chat_messages', 'chat_answer_evidence')
    and (
      column_name ~ '(payload|provider|crm|customer|secret|credential|image|embedding|blob)'
      or (column_name ~ 'token' and column_name <> 'guest_owner_token_digest')
      or (
        data_type in ('bytea', 'json', 'jsonb')
        and not (table_name = 'chat_messages' and column_name = 'content_blocks')
      )
      or udt_name = 'vector'
    )
), 'forbidden provider, customer, secret, blob, JSON, and vector columns are absent');
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000061', 'authenticated', 'authenticated', 'plan04-owner@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000062', 'authenticated', 'authenticated', 'plan04-other@example.test', '', now());

insert into public.conversations (id, owner_id, owner_scope, locale, consent_version, consent_expires_at, retention_expires_at)
values ('00000000-0000-4000-8000-000000000417', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() + interval '1 day', now() + interval '30 days');
select is((select conversation_storage_enabled from public.conversations where id = '00000000-0000-4000-8000-000000000417'), false, 'conversation storage defaults to disabled on an inserted row');
delete from public.conversations where id = '00000000-0000-4000-8000-000000000417';

select throws_ok($$ insert into public.conversations (id, owner_id, owner_scope, locale, consent_version, consent_expires_at, conversation_storage_enabled, retention_expires_at) values ('00000000-0000-4000-8000-000000000416', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() + interval '30 days', true, now() + interval '1 day') $$, '23514', null, 'consent expiry cannot exceed retention expiry');
select lives_ok($$ insert into public.conversations (id, owner_id, owner_scope, locale, consent_version, consent_expires_at, conversation_storage_enabled, retention_expires_at) values ('00000000-0000-4000-8000-000000000417', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days') $$, 'correct consent and retention ordering is accepted');
delete from public.conversations where id = '00000000-0000-4000-8000-000000000417';

insert into public.ai_sources (id, source_type, source_key, locale, canonical_url, visibility, approval_state, content_hash, ingestion_version)
values
  ('00000000-0000-4000-8000-000000000401', 'page', 'approved', 'en', 'https://example.test/approved', 'public', 'approved', repeat('a', 64), 'v1'),
  ('00000000-0000-4000-8000-000000000402', 'page', 'pending', 'en', 'https://example.test/pending', 'public', 'pending', repeat('b', 64), 'v1'),
  ('00000000-0000-4000-8000-000000000403', 'page', 'internal', 'ko', 'https://example.test/internal', 'internal', 'approved', repeat('c', 64), 'v1'),
  ('00000000-0000-4000-8000-000000000404', 'page', 'old', 'en', 'https://example.test/old', 'public', 'approved', repeat('d', 64), 'v1'),
  ('00000000-0000-4000-8000-000000000405', 'page', 'pending-two', 'en', 'https://example.test/pending-two', 'public', 'pending', repeat('f', 64), 'v1');
update public.ai_sources set superseded_by = '00000000-0000-4000-8000-000000000401' where id = '00000000-0000-4000-8000-000000000404';
insert into public.ai_chunks (source_id, locale, position, text_content, source_hash)
values
  ('00000000-0000-4000-8000-000000000401', 'en', 0, 'Approved source text.', repeat('a', 64)),
  ('00000000-0000-4000-8000-000000000402', 'en', 0, 'Pending source text.', repeat('b', 64));

select throws_ok($$ insert into public.ai_chunks (source_id, locale, position, text_content, source_hash) values ('00000000-0000-4000-8000-000000000401', 'ko', 1, 'Mismatched locale.', repeat('a', 64)) $$, '23514', null, 'chunk locale must match source locale');
select throws_ok($$ update public.ai_sources set superseded_by = '00000000-0000-4000-8000-000000000403' where id = '00000000-0000-4000-8000-000000000404' $$, '23514', null, 'supersession must stay within source identity and locale');

insert into public.conversations (id, owner_id, owner_scope, locale, consent_version, consent_expires_at, conversation_storage_enabled, retention_expires_at)
values
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days'),
  ('00000000-0000-4000-8000-000000000412', '00000000-0000-4000-8000-000000000062', 'auth', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days');
insert into public.chat_messages (id, conversation_id, role, content, expires_at)
values
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000411', 'user', 'Where is the approved source?', now() + interval '30 days'),
  ('00000000-0000-4000-8000-000000000422', '00000000-0000-4000-8000-000000000412', 'user', 'Other owner message.', now() + interval '30 days');
insert into public.chat_answer_evidence (message_id, source_id, tool_result_digest, model_version, prompt_version)
values
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000401', repeat('e', 64), 'model-v1', 'prompt-v1'),
  ('00000000-0000-4000-8000-000000000422', '00000000-0000-4000-8000-000000000401', repeat('d', 64), 'model-v1', 'prompt-v1');

insert into public.conversations (id, owner_id, owner_scope, locale, consent_version, consent_expires_at, conversation_storage_enabled, retention_expires_at, created_at)
values
  ('00000000-0000-4000-8000-000000000413', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() + interval '1 day', false, now() + interval '30 days', now()),
  ('00000000-0000-4000-8000-000000000414', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() - interval '1 day', true, now() + interval '30 days', now()),
  ('00000000-0000-4000-8000-000000000415', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() - interval '1 day', true, now() - interval '1 day', now() - interval '2 days');
insert into public.conversations (id, owner_id, owner_scope, locale, consent_version, consent_expires_at, conversation_storage_enabled, retention_expires_at, created_at, state)
values
  ('00000000-0000-4000-8000-000000000418', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() + interval '1 day', true, now() + interval '30 days', now(), 'deleted'),
  ('00000000-0000-4000-8000-000000000419', '00000000-0000-4000-8000-000000000061', 'auth', 'en', 'v1', now() - interval '2 days', true, now() - interval '1 day', now() - interval '2 days', 'active');
insert into public.chat_messages (id, conversation_id, role, content, expires_at)
values
  ('00000000-0000-4000-8000-000000000423', '00000000-0000-4000-8000-000000000418', 'assistant', 'Deleted conversation message.', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000424', '00000000-0000-4000-8000-000000000419', 'assistant', 'Expired conversation message.', now() - interval '1 day');
insert into public.chat_answer_evidence (message_id, source_id, tool_result_digest, model_version, prompt_version)
values
  ('00000000-0000-4000-8000-000000000423', '00000000-0000-4000-8000-000000000401', repeat('0', 64), 'model-v1', 'prompt-v1'),
  ('00000000-0000-4000-8000-000000000424', '00000000-0000-4000-8000-000000000401', repeat('1', 64), 'model-v1', 'prompt-v1');
insert into public.chat_messages (id, conversation_id, role, content, expires_at)
values ('00000000-0000-4000-8000-000000000425', '00000000-0000-4000-8000-000000000411', 'assistant', 'Expired message.', now() - interval '1 second');
insert into public.chat_answer_evidence (message_id, source_id, tool_result_digest, model_version, prompt_version)
values ('00000000-0000-4000-8000-000000000425', '00000000-0000-4000-8000-000000000401', repeat('2', 64), 'model-v1', 'prompt-v1');
insert into public.chat_answer_evidence (message_id, source_id, tool_result_digest, model_version, prompt_version)
values
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000403', repeat('3', 64), 'model-v1', 'prompt-v1'),
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000404', repeat('4', 64), 'model-v1', 'prompt-v1'),
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000405', repeat('5', 64), 'model-v1', 'prompt-v1');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.ai_sources), 1::bigint, 'anon reads only approved current public sources');
select is((select count(*) from public.ai_chunks), 1::bigint, 'anon reads chunks for approved current public sources');
select is((select count(*) from public.ai_chunks where lexical_index @@ plainto_tsquery('simple', 'Approved')), 1::bigint, 'lexical retrieval exposes eligible public chunks');
select ok(not has_table_privilege('anon', 'public.conversations', 'select'), 'anon has no conversation table privilege');
select ok(not has_table_privilege('anon', 'public.chat_answer_evidence', 'select'), 'anon has no answer evidence table privilege');

set local role postgres;
update public.ai_sources set is_active = false where id = '00000000-0000-4000-8000-000000000401';
set local role anon;
select is((select count(*) from public.ai_sources), 0::bigint, 'anon cannot read inactive sources');
select is((select count(*) from public.ai_chunks), 0::bigint, 'anon cannot read chunks for inactive sources');
set local role postgres;
delete from public.ai_sources where id = '00000000-0000-4000-8000-000000000402';
select is((select count(*) from public.ai_sources where id = '00000000-0000-4000-8000-000000000402'), 0::bigint, 'deleted sources are removed');
select is((select count(*) from public.ai_chunks where source_id = '00000000-0000-4000-8000-000000000402'), 0::bigint, 'deleted sources cascade their chunks');
update public.ai_sources set is_active = true where id = '00000000-0000-4000-8000-000000000401';

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000061', 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000061', true);
select is((select count(*) from public.ai_sources), 1::bigint, 'authenticated reads only approved current public sources');
select ok(not has_table_privilege('authenticated', 'public.conversations', 'select'), 'authenticated has no conversation read privilege');
select ok(not has_table_privilege('authenticated', 'public.chat_messages', 'select'), 'authenticated has no message read privilege');
select ok(not has_table_privilege('authenticated', 'public.chat_answer_evidence', 'select'), 'authenticated has no evidence read privilege');
select ok(
  not has_table_privilege('authenticated', 'public.conversations', 'insert')
  and not has_table_privilege('authenticated', 'public.conversations', 'update')
  and not has_table_privilege('authenticated', 'public.conversations', 'delete'),
  'authenticated has no conversation write privilege'
);
select ok(
  not has_table_privilege('authenticated', 'public.chat_messages', 'insert')
  and not has_table_privilege('authenticated', 'public.chat_messages', 'update')
  and not has_table_privilege('authenticated', 'public.chat_messages', 'delete'),
  'authenticated has no message write privilege'
);
select ok(
  not has_table_privilege('authenticated', 'public.chat_answer_evidence', 'insert')
  and not has_table_privilege('authenticated', 'public.chat_answer_evidence', 'update')
  and not has_table_privilege('authenticated', 'public.chat_answer_evidence', 'delete'),
  'authenticated has no evidence write privilege'
);
select throws_ok($$ select count(*) from public.conversations $$, '42501', null, 'authenticated cannot query conversations directly');
select throws_ok($$ select count(*) from public.chat_messages $$, '42501', null, 'authenticated cannot query messages directly');
select throws_ok($$ select count(*) from public.chat_answer_evidence $$, '42501', null, 'authenticated cannot query evidence directly');
select throws_ok($$ insert into public.conversations (owner_scope, locale, consent_version, consent_expires_at, retention_expires_at) values ('auth', 'en', 'v1', now() + interval '1 day', now() + interval '30 days') $$, '42501', null, 'authenticated cannot insert conversations directly');
select throws_ok($$ insert into public.chat_messages (conversation_id, role, content, expires_at) values ('00000000-0000-4000-8000-000000000411', 'user', 'blocked', now() + interval '1 day') $$, '42501', null, 'authenticated cannot insert messages directly');
select throws_ok($$ insert into public.chat_answer_evidence (message_id, model_version, prompt_version) values ('00000000-0000-4000-8000-000000000421', 'blocked', 'blocked') $$, '42501', null, 'authenticated cannot insert evidence directly');

set local role service_role;
select ok(has_table_privilege('service_role', 'public.conversations', 'select'), 'service role can read conversations');
select ok(has_table_privilege('service_role', 'public.chat_messages', 'select'), 'service role can read messages');
select ok(has_table_privilege('service_role', 'public.chat_answer_evidence', 'select'), 'service role can read evidence');
select is((select count(*) from public.conversations where id = '00000000-0000-4000-8000-000000000411'), 1::bigint, 'service role reads persisted conversation');
select is((select count(*) from public.chat_messages where id = '00000000-0000-4000-8000-000000000421'), 1::bigint, 'service role reads persisted message');
select is((select count(*) from public.chat_answer_evidence where message_id = '00000000-0000-4000-8000-000000000421'), 4::bigint, 'service role reads persisted evidence');

set local role postgres;
select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('ai_sources', 'ai_chunks', 'conversations', 'chat_messages', 'chat_answer_evidence') and 'staff' = any(roles)), 'staff has no Plan 04 policies');
select ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name in ('ai_sources', 'ai_chunks', 'conversations', 'chat_messages', 'chat_answer_evidence') and grantee = 'staff'), 'staff has no Plan 04 table grants');
select ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and table_name in ('ai_sources', 'ai_chunks', 'conversations', 'chat_messages', 'chat_answer_evidence') and grantee = 'PUBLIC'), 'Plan 04 tables have no broad PUBLIC grants');
select ok((select count(*) from pg_policies where schemaname = 'public' and tablename = 'ai_sources' and roles = array['anon', 'authenticated']::name[]) = 1, 'source policy has only anon and authenticated roles');
select ok((select count(*) from pg_policies where schemaname = 'public' and tablename = 'ai_chunks' and roles = array['anon', 'authenticated']::name[]) = 1, 'chunk policy has only anon and authenticated roles');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename in ('conversations', 'chat_messages', 'chat_answer_evidence')), 0::bigint, 'chat transcript tables expose no browser RLS policies');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename in ('ai_sources', 'ai_chunks', 'conversations', 'chat_messages', 'chat_answer_evidence')), 2::bigint, 'Plan 04 retains only two public retrieval policies');

select * from finish();
rollback;
