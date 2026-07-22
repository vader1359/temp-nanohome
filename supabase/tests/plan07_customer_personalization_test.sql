begin;

set local role postgres;

select plan(28);

select is(
  (select format_type(atttypid, atttypmod)
   from pg_attribute
   where attrelid = 'public.customer_recent_entities'::regclass
     and attname = 'entity_id'),
  (select format_type(atttypid, atttypmod)
   from pg_attribute
   where attrelid = 'public.products'::regclass
     and attname = 'id'),
  'recent entity IDs use the real product ID database type');
select is(
  (select format_type(atttypid, atttypmod)
   from pg_attribute
   where attrelid = 'public.customer_recent_entities'::regclass
     and attname = 'entity_id'),
  (select format_type(atttypid, atttypmod)
   from pg_attribute
   where attrelid = 'public.variants'::regclass
     and attname = 'id'),
  'recent entity IDs use the real variant ID database type');

select ok((select relrowsecurity from pg_class where oid = 'public.customer_preferences'::regclass), 'preferences have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.customer_recent_entities'::regclass), 'recent entities have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.customer_affinities'::regclass), 'affinities have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.personalization_decisions'::regclass), 'decisions have RLS enabled');
set local role anon;
select throws_ok($$ select count(*) from public.customer_preferences $$, '42501', null, 'anon cannot read preferences');
select throws_ok($$ select count(*) from public.customer_preferences_active $$, '42501', null, 'anon cannot read active preferences');
select throws_ok($$ select count(*) from public.customer_recent_entities_active $$, '42501', null, 'anon cannot read active recent entities');
set local role authenticated;
select throws_ok($$ insert into public.customer_recent_entities (visitor_id, entity_type, entity_id, expires_at)
  values ('00000000-0000-4000-8000-000000000701', 'variant', '00000000-0000-4000-8000-000000000799', now() + interval '1 day') $$,
  '42501', null, 'authenticated cannot write recent entities');
select throws_ok($$ select count(*) from public.customer_recent_entities_active $$, '42501', null, 'authenticated cannot read active recent entities');
select throws_ok($$ select count(*) from public.customer_preferences_active $$, '42501', null, 'authenticated cannot read active preferences');
set local role postgres;
select ok(has_table_privilege('service_role', 'public.customer_affinities', 'select'), 'service role can read affinities');
select ok(not exists (
  select 1
  from pg_proc
  where pronamespace = 'public'::regnamespace
    and proname like 'plan07_%'
    and prosecdef
), 'Plan 07 functions are not security definer');

insert into public.customer_visitors (id, visitor_token_hash)
values ('00000000-0000-4000-8000-000000000701', 'plan07-visitor-hash');

insert into public.customer_consent_ledger
  (visitor_id, policy_version, locale, source, actor, personalization, recorded_at)
values
  ('00000000-0000-4000-8000-000000000701', 'plan07-test', 'en', 'test', 'worker', true, now());
select is((select personalization from public.customer_consent_current where visitor_id = '00000000-0000-4000-8000-000000000701'), true, 'consent projection enables durable personalization views');

insert into public.customer_preferences
  (visitor_id, feature_type, feature_key, feature_value, source, expires_at)
values
  ('00000000-0000-4000-8000-000000000701', 'style_tag', 'calm', 'active', 'customer_explicit', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000701', 'style_tag', 'calm', 'expired', 'customer_explicit', now() - interval '1 minute'),
  ('00000000-0000-4000-8000-000000000701', 'style_tag', 'swap', 'same', 'customer_explicit', now() - interval '1 minute');

insert into public.customer_preferences
  (visitor_id, feature_type, feature_key, feature_value, source, expires_at)
values
  ('00000000-0000-4000-8000-000000000701', 'style_tag', 'swap', 'same', 'customer_explicit', now() + interval '1 day');

insert into public.customer_recent_entities
  (visitor_id, entity_type, entity_id, expires_at)
values
  ('00000000-0000-4000-8000-000000000701', 'variant', '00000000-0000-4000-8000-000000000702', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000701', 'variant', '00000000-0000-4000-8000-000000000703', now() - interval '1 minute'),
  ('00000000-0000-4000-8000-000000000701', 'variant', '00000000-0000-4000-8000-000000000704', now() - interval '1 minute');

insert into public.customer_recent_entities
  (visitor_id, entity_type, entity_id, expires_at)
values
  ('00000000-0000-4000-8000-000000000701', 'variant', '00000000-0000-4000-8000-000000000704', now() + interval '1 day');

insert into public.customer_affinities
  (visitor_id, feature_type, feature_key, score, support_count, distinct_session_count, algorithm_version,
   window_started_at, last_evidence_at, expires_at, suppressed_at)
values
  ('00000000-0000-4000-8000-000000000701', 'style_tag', 'calm', .8, 2, 1, 'v1', now() - interval '1 day', now(), now() + interval '1 day'),
   ('00000000-0000-4000-8000-000000000701', 'style_tag', 'loud', .2, 2, 1, 'v1', now() - interval '1 day', now(), now() + interval '1 day', now()),
   ('00000000-0000-4000-8000-000000000701', 'palette_tag', 'swap', .2, 2, 1, 'v1', now() - interval '1 day', now(), now() - interval '1 minute');

insert into public.customer_affinities
  (visitor_id, feature_type, feature_key, score, support_count, distinct_session_count, algorithm_version,
   window_started_at, last_evidence_at, expires_at)
values
  ('00000000-0000-4000-8000-000000000701', 'palette_tag', 'swap', .9, 2, 1, 'v1', now() - interval '1 day', now(), now() + interval '1 day');

insert into public.personalization_decisions
  (visitor_id, placement, context_version, algorithm_version, strategy_key, fallback_tier, expires_at)
values
  ('00000000-0000-4000-8000-000000000701', 'pdp', 'v1', 'v1', 'curated', 'curated', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000701', 'pdp', 'v1', 'v1', 'expired', 'curated', now() - interval '1 minute'),
  ('00000000-0000-4000-8000-000000000701', 'pdp', 'v1', 'v1', 'swap', 'curated', now() - interval '1 minute');

insert into public.personalization_decisions
  (visitor_id, placement, context_version, algorithm_version, strategy_key, fallback_tier, expires_at)
values
  ('00000000-0000-4000-8000-000000000701', 'pdp', 'v1', 'v1', 'swap', 'curated', now() + interval '1 day');

select is((select count(*) from public.customer_preferences_active), 2::bigint, 'active preferences exclude expired rows and permit replacement');
select is((select count(*) from public.customer_recent_entities_active), 2::bigint, 'active recent entities exclude expired rows and permit replacement');
select is((select count(*) from public.customer_affinities_active), 2::bigint, 'active affinities exclude suppressed rows and permit replacement');
select is((select count(*) from public.personalization_decisions_active), 2::bigint, 'active decisions exclude expired rows and permit replacement');

update public.customer_consent_current
set personalization = false, withdrawn_at = now(), withdrawal_reason = 'plan07 test withdrawal'
where visitor_id = '00000000-0000-4000-8000-000000000701';
select is((select count(*) from public.customer_preferences_active), 0::bigint, 'withdrawal suppresses active preferences');
select is((select count(*) from public.customer_recent_entities_active), 0::bigint, 'withdrawal suppresses active recent entities');
select is((select count(*) from public.customer_affinities_active), 0::bigint, 'withdrawal suppresses active affinities');
select is((select count(*) from public.personalization_decisions_active), 0::bigint, 'withdrawal suppresses active decisions');

select lives_ok($$ delete from public.customer_visitors where id = '00000000-0000-4000-8000-000000000701' $$, 'visitor deletion is allowed for the local worker role');
select is((select count(*) from public.customer_preferences where visitor_id = '00000000-0000-4000-8000-000000000701'), 0::bigint, 'visitor deletion cascades preferences');
select is((select count(*) from public.customer_recent_entities where visitor_id = '00000000-0000-4000-8000-000000000701'), 0::bigint, 'visitor deletion cascades recent entities');
select is((select count(*) from public.customer_affinities where visitor_id = '00000000-0000-4000-8000-000000000701'), 0::bigint, 'visitor deletion cascades affinities');
select is((select count(*) from public.personalization_decisions where visitor_id = '00000000-0000-4000-8000-000000000701'), 0::bigint, 'visitor deletion cascades decisions');

select * from finish();
rollback;
