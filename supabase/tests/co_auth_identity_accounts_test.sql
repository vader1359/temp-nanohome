begin;

select plan(25);

select has_table(
  'public',
  'customer_account_verified_identities',
  'Customers-only verified identities table exists'
);
select ok(
  to_regclass('public.customer_account_contacts') is null,
  'legacy contact persistence is absent'
);
select has_table(
  'public',
  'account_identity_events',
  'identity events table exists'
);
select has_function(
  'public',
  'resolve_or_create_account',
  array['text', 'text', 'text', 'text', 'jsonb'],
  'non-CRM account resolution RPC exists'
);
select has_column(
  'public',
  'account_identity_events',
  'identity_digest',
  'identity events store opaque identity digests'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.customer_account_verified_identities',
    'select'
  ),
  'anonymous callers cannot read verified identities'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.customer_account_verified_identities',
    'select'
  ),
  'authenticated browser callers cannot read verified identities'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.account_identity_events',
    'select'
  ),
  'authenticated browser callers cannot read identity events'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.resolve_or_create_account(text,text,text,text,jsonb)',
    'execute'
  ),
  'browser callers cannot execute account resolution RPC'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where indexname =
      'customer_account_verified_identities_active_digest_idx'
  ),
  'active verified identity digest uniqueness is indexed'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where indexname = 'account_identity_events_idempotency_idx'
  ),
  'identity replay idempotency is indexed'
);
select ok(
  exists (
    select 1
    from pg_description description
    join pg_class relation
      on relation.oid = description.objoid
    where relation.relname = 'account_identity_events'
      and description.description like '%raw phone%'
  ),
  'identity event contract excludes raw identity values'
);

select is(
  (
    select outcome
    from public.resolve_or_create_account(
      'firebase-co-auth-phone-only',
      null,
      repeat('1', 64),
      'co-auth-phone-first',
      '{"identity":"identity-v2","lookup":"hmac-sha256-nul-v1"}'::jsonb
    )
  ),
  'created'::text,
  'a regular account can be created after one verified phone factor'
);
select is(
  (
    select count(*)
    from public.customer_account_verified_identities verified_identity
    join public.customer_firebase_principals principal
      on principal.account_id = verified_identity.account_id
    where principal.firebase_uid = 'firebase-co-auth-phone-only'
      and verified_identity.status = 'active'
  ),
  1::bigint,
  'one-factor registration stores only the verified identity'
);
select is(
  (
    select checkout_ready
    from public.customer_account_identity_assurance(
      'firebase-co-auth-phone-only'
    )
  ),
  true,
  'one verified phone factor is checkout ready'
);

select claim_status, phone_verified, email_verified, checkout_ready
from public.claim_customer_account_precreation(
  'firebase-co-auth-phone-only',
  repeat('1', 64),
  repeat('2', 64),
  true,
  true,
  '[]'::jsonb
) \gset progressive_

select is(
  :'progressive_claim_status'::text,
  'already_claimed'::text,
  'a non-CRM Firebase principal can progressively add assurance'
);
select is(
  :'progressive_phone_verified'::boolean,
  true,
  'progressive assurance preserves verified phone'
);
select is(
  :'progressive_email_verified'::boolean,
  true,
  'progressive assurance adds verified email'
);
select is(
  :'progressive_checkout_ready'::boolean,
  true,
  'progressive verification remains checkout ready'
);

select checkout_ready
from public.customer_account_identity_assurance(
  'firebase-co-auth-phone-only'
) \gset assurance_
select is(
  :'assurance_checkout_ready'::boolean,
  true,
  'read-only assurance covers non-CRM authenticated accounts'
);

select is(
  (
    select outcome
    from public.resolve_or_create_account(
      'firebase-co-auth-phone-only',
      repeat('2', 64),
      repeat('1', 64),
      'co-auth-replay',
      '{"identity":"identity-v2","lookup":"hmac-sha256-nul-v1"}'::jsonb
    )
  ),
  'existing_principal'::text,
  'fallback RPC replay keeps the same authenticated principal'
);

select throws_ok(
  $$
    select *
    from public.resolve_or_create_account(
      'firebase-no-factor',
      null,
      null,
      'co-auth-no-factor',
      '{}'::jsonb
    )
  $$,
  'P0001',
  'identity_resolution_invalid',
  'no-factor account creation fails closed'
);

select throws_ok(
  $$
    select *
    from public.resolve_or_create_account(
      'firebase-identity-conflict',
      repeat('2', 64),
      repeat('3', 64),
      'co-auth-conflict',
      '{"identity":"identity-v2","lookup":"hmac-sha256-nul-v1"}'::jsonb
    )
  $$,
  'P0001',
  'identity_conflict',
  'an active verified identity cannot be attached to another account'
);

select is(
  (
    select count(*)
    from public.customer_account_verified_identities verified_identity
    join public.customer_firebase_principals principal
      on principal.account_id = verified_identity.account_id
    where principal.firebase_uid = 'firebase-co-auth-phone-only'
      and verified_identity.status = 'active'
  ),
  2::bigint,
  'failed cross-account reuse leaves exactly two verified identities'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'customer_account_verified_identities',
        'account_identity_events'
      )
      and column_name in (
        'amis_contact_id',
        'encrypted_normalized_value',
        'raw_email',
        'raw_phone'
      )
  ),
  'identity persistence contains no AMIS Contact ID or raw PII field'
);

select * from finish();
rollback;
