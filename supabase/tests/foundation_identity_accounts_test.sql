begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  (:'authenticated_user_id', 'authenticated', 'authenticated', 'foundation-owner@example.test', '', now()),
  (:'other_user_id', 'authenticated', 'authenticated', 'foundation-other@example.test', '', now());

select plan(16);

select is(
  (select count(*) from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  1::bigint,
  'legacy Supabase users receive an internal customer account'
);

select is(
  (select count(*) from public.customer_identity_providers),
  0::bigint,
  'identity providers are disabled until configured by a privileged actor'
);

set local role postgres;

insert into public.customer_identity_providers (provider, issuer, audience)
values
  ('firebase', 'https://securetoken.google.com/foundation-test-project', 'foundation-test-project'),
  ('supabase', 'https://foundation.supabase.test/auth/v1', 'authenticated');

insert into public.customer_firebase_principals (account_id, firebase_uid, status)
select id, 'firebase-user-with-a-non-uuid-subject', 'active'
from public.customer_accounts
where legacy_supabase_user_id = :'authenticated_user_id'::uuid;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'firebase-user-with-a-non-uuid-subject',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-test-project',
    'aud', 'foundation-test-project',
    'account_id', :'other_user_id'
  )::text,
  true
);

select is(
  public.current_customer_account_id(),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'Firebase identity resolves from the mapped non-UUID subject instead of a browser account claim'
);

select is(
  (select count(*) from public.customer_accounts),
  1::bigint,
  'mapped Firebase identity reads only its account'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'firebase-user-with-a-non-uuid-subject',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/other-project',
    'aud', 'foundation-test-project'
  )::text,
  true
);

select is(public.current_customer_account_id(), null::uuid, 'Firebase identity rejects an untrusted issuer');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'firebase-user-with-a-non-uuid-subject',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-test-project',
    'aud', 'other-project'
  )::text,
  true
);

select is(public.current_customer_account_id(), null::uuid, 'Firebase identity rejects an untrusted audience');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'firebase-user-with-a-non-uuid-subject',
    'role', 'anon',
    'iss', 'https://securetoken.google.com/foundation-test-project',
    'aud', 'foundation-test-project'
  )::text,
  true
);

select is(public.current_customer_account_id(), null::uuid, 'Firebase identity requires the authenticated role');

set local role postgres;
update public.customer_firebase_principals
set status = 'disabled',
    disabled_at = now()
where firebase_uid = 'firebase-user-with-a-non-uuid-subject';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'firebase-user-with-a-non-uuid-subject',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-test-project',
    'aud', 'foundation-test-project'
  )::text,
  true
);

select is(public.current_customer_account_id(), null::uuid, 'disabled Firebase principals cannot resolve an account');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'unmapped-firebase-subject',
    'role', 'authenticated',
    'iss', 'https://securetoken.google.com/foundation-test-project',
    'aud', 'foundation-test-project'
  )::text,
  true
);

select is(public.current_customer_account_id(), null::uuid, 'unmapped Firebase principals cannot resolve an account');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'authenticated_user_id',
    'role', 'authenticated',
    'iss', 'https://foundation.supabase.test/auth/v1',
    'aud', 'authenticated'
  )::text,
  true
);

select is(
  public.current_customer_account_id(),
  (select id from public.customer_accounts where legacy_supabase_user_id = :'authenticated_user_id'::uuid),
  'allowlisted legacy Supabase identity resolves the internal account'
);

select set_config('request.jwt.claims', '{malformed', true);
select is(public.current_customer_account_id(), null::uuid, 'malformed claims cannot resolve an account');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'authenticated_user_id',
    'role', 'authenticated',
    'iss', 'https://foundation.supabase.test/auth/v1',
    'aud', 'other-audience'
  )::text,
  true
);
select is(public.current_customer_account_id(), null::uuid, 'legacy Supabase identity requires the configured audience');

select is(
  (select count(*) from pg_proc where proname = 'current_customer_account_id' and prosecdef),
  1::bigint,
  'account resolver is a security-definer function'
);

select is(
  (select proconfig @> array['search_path=public'] from pg_proc where proname = 'current_customer_account_id' and prosecdef),
  true,
  'account resolver pins its search path'
);

set local role postgres;

select ok(
  not has_function_privilege('anon', 'public.current_customer_account_id()', 'execute'),
  'anonymous callers cannot execute the account resolver'
);

select ok(
  not has_function_privilege('authenticated', 'public.ensure_customer_account_for_legacy_user()', 'execute'),
  'authenticated callers cannot execute the account trigger helper'
);

select * from finish();

rollback;
