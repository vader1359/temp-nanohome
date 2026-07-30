begin;

\ir fixtures.sql

set local role postgres;
select plan(49);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_account_precreation_batches'::regclass),
  'precreation batches have RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_account_claim_candidates'::regclass),
  'claim candidates have RLS'
);
select ok(
  not has_table_privilege('anon', 'public.customer_account_claim_candidates', 'select'),
  'browser cannot read claim candidates'
);
select ok(
  not has_table_privilege('authenticated', 'public.customer_account_verified_identities', 'select'),
  'browser cannot read verified identity digests'
);
select ok(
  not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.customer_account_precreation_items'::regclass
      and attname = 'amis_contact_id'
      and not attisdropped
  ),
  'precreation persistence contains no AMIS Contact identifier'
);
select ok(
  to_regclass('public.customer_account_verified_contacts') is null,
  'legacy verified Contacts table name is absent'
);
select ok(
  has_function_privilege('service_role', 'public.precreate_customer_account_item(uuid,text,integer,text,text,text,text,timestamptz,uuid)', 'execute'),
  'service role can execute item precreation'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_customer_account_precreation(text,text,text,boolean,boolean,jsonb)', 'execute'),
  'authenticated callers cannot execute claim'
);
select ok(
  has_function_privilege('service_role', 'public.customer_account_identity_assurance(text)', 'execute'),
  'service role can read checkout assurance'
);
select ok(
  not has_function_privilege('authenticated', 'public.customer_account_identity_assurance(text)', 'execute'),
  'authenticated callers cannot read assurance directly'
);

select batch_id, batch_status
from public.begin_customer_account_precreation_batch(
  'staging', 'amis-account-precreate-v3', repeat('1', 64), '2026-07-30T00:00:00.000Z', 2, 'owner-fixture'
) \gset batch_

select is(:'batch_batch_status'::text, 'approved'::text, 'owner-approved batch starts approved');

select result_code, account_id::text
from public.precreate_customer_account_item(
  :'batch_batch_id'::uuid, repeat('1', 64), 1, 'amis-customer-phone',
  repeat('2', 64), repeat('3', 64), null, '2026-07-29T23:00:00.000Z',
  '00000000-0000-5000-8000-000000000401'
) \gset phone_item_
select is(:'phone_item_result_code'::text, 'created'::text, 'phone-only CRM record is precreated');
select is(
  (select email_lookup_digest from public.customer_account_claim_candidates where account_id = :'phone_item_account_id'::uuid),
  null::text,
  'phone-only candidate keeps email digest null'
);

select result_code, account_id::text
from public.precreate_customer_account_item(
  :'batch_batch_id'::uuid, repeat('1', 64), 2, 'amis-customer-email',
  repeat('7', 64), null, repeat('8', 64), '2026-07-29T23:00:00.000Z',
  '00000000-0000-5000-8000-000000000402'
) \gset email_item_
select is(:'email_item_result_code'::text, 'created'::text, 'email-only CRM record is precreated');
select is(
  (select phone_lookup_digest from public.customer_account_claim_candidates where account_id = :'email_item_account_id'::uuid),
  null::text,
  'email-only candidate keeps phone digest null'
);
select is(
  (select count(*)::integer from public.customer_firebase_principals),
  0,
  'batch precreation creates no Firebase principal'
);

select claim_status, account_id::text, phone_verified, email_verified, checkout_ready
from public.claim_customer_account_precreation(
  'firebase-phone-user', repeat('3', 64), null, true, false,
  '[{"kind":"terms","version":"2026-07"}]'::jsonb
) \gset phone_claim_

select is(:'phone_claim_claim_status'::text, 'claimed'::text, 'verified phone alone claims the account');
select is(:'phone_claim_phone_verified'::boolean, true, 'phone assurance is recorded');
select is(:'phone_claim_email_verified'::boolean, false, 'email remains unverified after phone claim');
select is(:'phone_claim_checkout_ready'::boolean, false, 'one-factor claim is not checkout ready');
select is(
  (select count(*)::integer from public.customer_account_verified_identities where account_id = :'phone_claim_account_id'::uuid and status = 'active'),
  1,
  'first claim stores only the verified phone digest'
);
select is(
  (select state from public.customer_amis_links where amis_customer_id = 'amis-customer-phone'),
  'active',
  'one-factor claim activates the AMIS link'
);

select claim_status
from public.claim_customer_account_precreation(
  'firebase-phone-user', null, repeat('8', 64), false, true, '[]'::jsonb
) \gset replay_conflict_
select is(:'replay_conflict_claim_status'::text, 'conflict'::text, 'claimed UID cannot take a factor reserved for another candidate');
select is(
  (select count(*)::integer from public.customer_account_verified_identities where account_id = :'phone_claim_account_id'::uuid and kind = 'email' and status = 'active'),
  0,
  'replay conflict adds no second factor'
);

select claim_status, account_id::text, phone_verified, email_verified, checkout_ready
from public.claim_customer_account_precreation(
  'firebase-phone-user', null, repeat('4', 64), false, true, '[]'::jsonb
) \gset progressive_
select is(:'progressive_claim_status'::text, 'already_claimed'::text, 'same UID can add a verified second factor');
select is(:'progressive_phone_verified'::boolean, true, 'existing phone assurance is preserved');
select is(:'progressive_email_verified'::boolean, true, 'new verified email assurance is recorded');
select is(:'progressive_checkout_ready'::boolean, true, 'both verified identities make checkout ready');
select is(
  (select count(*)::integer from public.customer_account_verified_identities where account_id = :'progressive_account_id'::uuid and status = 'active'),
  2,
  'progressive verification stores exactly two active identities'
);

select account_id::text, registration_claimed, phone_verified, email_verified, checkout_ready
from public.customer_account_identity_assurance('firebase-phone-user') \gset assurance_
select is(:'assurance_registration_claimed'::boolean, true, 'assurance reports claimed registration');
select is(:'assurance_checkout_ready'::boolean, true, 'assurance reports checkout readiness');

select claim_status, account_id::text, phone_verified, email_verified, checkout_ready
from public.claim_customer_account_precreation(
  'firebase-email-user', null, repeat('8', 64), false, true, '[]'::jsonb
) \gset email_claim_
select is(:'email_claim_claim_status'::text, 'claimed'::text, 'verified email alone claims the account');
select is(:'email_claim_phone_verified'::boolean, false, 'email-only claim has no verified phone');
select is(:'email_claim_checkout_ready'::boolean, false, 'email-only claim is not checkout ready');

select claim_status
from public.claim_customer_account_precreation(
  'firebase-no-factor', null, null, false, false, '[]'::jsonb
) \gset no_factor_
select is(:'no_factor_claim_status'::text, 'not_claimable'::text, 'no-factor request cannot claim');
select is(
  (select count(*)::integer from public.customer_firebase_principals where firebase_uid = 'firebase-no-factor'),
  0,
  'no-factor rejection creates no principal'
);

select batch_status, expected_count, processed_count, created_count, skipped_count, conflict_count, failed_count, drift_count
from public.reconcile_customer_account_precreation_batch(:'batch_batch_id'::uuid, repeat('1', 64)) \gset reconcile_
select is(:'reconcile_batch_status'::text, 'reconciled'::text, 'claimed one-factor items reconcile');
select is(:'reconcile_processed_count'::integer, 2, 'reconcile counts both claimed items');
select is(:'reconcile_drift_count'::integer, 0, 'reconcile reports zero drift');

select batch_id
from public.begin_customer_account_precreation_batch(
  'staging', 'amis-account-precreate-v3', repeat('5', 64), '2026-07-30T00:00:00.000Z', 2, 'owner-fixture'
) \gset conflict_batch_
select result_code
from public.precreate_customer_account_item(
  :'conflict_batch_batch_id'::uuid, repeat('5', 64), 1, 'amis-cross-phone',
  repeat('a', 64), repeat('b', 64), null, '2026-07-29T23:00:00.000Z',
  '00000000-0000-5000-8000-000000000403'
) \gset cross_phone_
select result_code
from public.precreate_customer_account_item(
  :'conflict_batch_batch_id'::uuid, repeat('5', 64), 2, 'amis-cross-email',
  repeat('c', 64), null, repeat('d', 64), '2026-07-29T23:00:00.000Z',
  '00000000-0000-5000-8000-000000000404'
) \gset cross_email_
select is(:'cross_phone_result_code'::text, 'created'::text, 'cross-factor phone candidate is created');
select is(:'cross_email_result_code'::text, 'created'::text, 'cross-factor email candidate is created');

select claim_status
from public.claim_customer_account_precreation(
  'firebase-cross-user', repeat('b', 64), repeat('d', 64), true, true, '[]'::jsonb
) \gset cross_claim_
select is(:'cross_claim_claim_status'::text, 'conflict'::text, 'phone and email matching different candidates conflict');
select is(
  (select count(*)::integer from public.customer_firebase_principals where firebase_uid = 'firebase-cross-user'),
  0,
  'cross-candidate conflict creates no principal'
);

select batch_status, rolled_back_count, claimed_preserved_count
from public.rollback_customer_account_precreation_batch(:'conflict_batch_batch_id'::uuid, repeat('5', 64)) \gset rollback_
select is(:'rollback_batch_status'::text, 'rolled_back'::text, 'rollback marks the exact conflict batch rolled back');
select is(:'rollback_rolled_back_count'::integer, 2, 'rollback revokes both unclaimed candidates');
select is(:'rollback_claimed_preserved_count'::integer, 0, 'unclaimed rollback has no claimed preservation');
select is(
  (select count(*)::integer from public.customer_accounts where id in (
    '00000000-0000-5000-8000-000000000403'::uuid,
    '00000000-0000-5000-8000-000000000404'::uuid
  ) and state = 'disabled'),
  2,
  'rollback disables both unclaimed accounts'
);

select rolled_back_count
from public.rollback_customer_account_precreation_batch(:'conflict_batch_batch_id'::uuid, repeat('5', 64)) \gset rollback_again_
select is(:'rollback_again_rolled_back_count'::integer, 0, 'rollback replay is idempotent');

select is(
  (select count(*)::integer from public.customer_account_precreation_audit where batch_id = :'batch_batch_id'::uuid),
  7,
  'audit contains approval, two creates, two claims, replay, and reconcile'
);

select * from finish();

rollback;
