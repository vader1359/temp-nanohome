-- Foundation Todo 13: restricted AMIS, recommendation, and personalization setting contracts.
-- Verifies restricted raw tables stay service-only, safe projections and settings stay
-- owner-scoped and expiry-bounded, behavioral history defaults off, canonical variant
-- linkage is enforced, forbidden CRM mirrors are absent, and the historical consent
-- ledger is retained.
begin;

\ir fixtures.sql

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  (:'authenticated_user_id', 'authenticated', 'authenticated', 'owner-13@example.test', '', now()),
  (:'other_user_id', 'authenticated', 'authenticated', 'other-13@example.test', '', now())
on conflict (id) do nothing;

select id as owner_account_id
from public.customer_accounts
where legacy_supabase_user_id = :'authenticated_user_id'::uuid \gset

select id as other_account_id
from public.customer_accounts
where legacy_supabase_user_id = :'other_user_id'::uuid \gset

insert into public.customer_identity_providers (provider, issuer, audience)
values ('supabase', 'https://foundation.supabase.test/auth/v1', 'authenticated')
on conflict (provider) do nothing;

insert into public.customer_visitors (id, visitor_token_hash)
values ('00000000-0000-4000-8000-000000000801', 'todo13-visitor-hash-1');

insert into public.customer_consent_ledger
  (visitor_id, policy_version, locale, source, actor, personalization)
values
  ('00000000-0000-4000-8000-000000000801', '2026-01-01', 'vi-VN', 'banner', 'visitor', true);

select id as consent_ledger_id
from public.customer_consent_ledger
where visitor_id = '00000000-0000-4000-8000-000000000801'::uuid \gset

select count(*)::bigint as consent_history_before
from public.customer_consent_ledger \gset

insert into public.amis_customer_snapshots
  (amis_customer_id, source_updated_at, source_state, payload_digest, mapper_version)
values
  ('AMIS-CUST-13-OWNER', now(), 'active', repeat('a', 64), 'plan03.1'),
  ('AMIS-CUST-13-OTHER', now(), 'active', repeat('b', 64), 'plan03.1');

insert into public.customer_amis_links
  (id, user_id, amis_customer_id, state, method, evidence_category)
values
  ('00000000-0000-4000-8000-000000000811', :'authenticated_user_id',
   'AMIS-CUST-13-OWNER', 'verified', 'staff_exact_code', 'staff_verified'),
  ('00000000-0000-4000-8000-000000000812', :'other_user_id',
   'AMIS-CUST-13-OTHER', 'verified', 'staff_exact_code', 'staff_verified');

insert into public.customer_memory_projections
  (link_id, user_id, memory, source_updated_at, projection_version, source_watermark)
values
  ('00000000-0000-4000-8000-000000000811', :'authenticated_user_id',
   '{}'::jsonb, now(), 'plan03.1', now()),
  ('00000000-0000-4000-8000-000000000812', :'other_user_id',
   '{}'::jsonb, now(), 'plan03.1', now());

insert into public.products (id, name)
values
  (:'prod_id_1', 'Todo13 Product 1'),
  (:'prod_id_2', 'Todo13 Product 2'),
  (:'prod_id_3', 'Todo13 Product 3')
on conflict (id) do nothing;

insert into public.variants (id, product_id, name)
values
  (:'variant_id_1', :'prod_id_1', 'Todo13 Variant 1'),
  (:'variant_id_2', :'prod_id_1', 'Todo13 Variant 2'),
  (:'variant_id_3', :'prod_id_2', 'Todo13 Variant 3'),
  (:'variant_id_4', :'prod_id_2', 'Todo13 Variant 4'),
  (:'variant_id_5', :'prod_id_3', 'Todo13 Variant 5')
on conflict (id) do nothing;

insert into public.variant_recommendation_features
  (variant_id, product_id, price_band, has_primary_image, eligible, feature_version)
values (:'variant_id_1', :'prod_id_1', 'mid', true, true, 'plan03.1');

insert into public.customer_recommendation_signals
  (account_id, link_id, variant_id, signal_kind, signal_source, expires_at,
   projection_version)
values
  (:'owner_account_id', '00000000-0000-4000-8000-000000000811', :'variant_id_1',
   'purchased', 'amis_sale_order', now() + interval '30 days', 'plan03.1'),
  (:'owner_account_id', null, :'variant_id_2', 'excluded', 'customer_explicit',
   now() + interval '30 days', 'plan03.1'),
  (:'other_account_id', '00000000-0000-4000-8000-000000000812', :'variant_id_3',
   'purchased', 'amis_sale_order', now() + interval '30 days', 'plan03.1');

insert into public.customer_personalization_settings
  (account_id, user_id, policy_version)
values
  (:'owner_account_id', :'authenticated_user_id', '2026-01-01'),
  (:'other_account_id', :'other_user_id', '2026-01-01');

select plan(49);

-- Structure -----------------------------------------------------------------
select has_table('public', 'amis_contact_snapshots', 'restricted AMIS contact snapshots exist');
select has_table('public', 'customer_memory_briefs', 'staff-approved memory briefs exist');
select has_table('public', 'customer_recommendation_signals', 'recommendation signals exist');
select has_table('public', 'variant_recommendation_features', 'canonical variant features exist');
select has_table('public', 'customer_personalization_settings', 'personalization settings exist');
select has_view('public', 'customer_memory_projections_safe', 'safe memory projection view exists');
select has_view('public', 'customer_memory_briefs_safe', 'safe brief view exists');
select has_view('public', 'customer_recommendation_signals_safe', 'safe signal view exists');
select has_view('public', 'customer_personalization_settings_safe', 'safe settings view exists');
select has_table('public', 'customer_consent_ledger', 'historical consent ledger is retained');

-- Completed safe projection columns -----------------------------------------
select is(
  (select count(*) from pg_attribute
   where attrelid = 'public.customer_memory_projections'::regclass
     and attname in ('purchased_variant_ids', 'discussed_variant_ids', 'preferred_room_ids',
                     'preferred_brand_ids', 'project_stage', 'customer_visible_summary',
                     'source_watermark', 'generated_at')
     and not attisdropped),
  8::bigint,
  'safe projection carries variant, preference, stage, summary, watermark, and generation fields');

-- Contract constraints ------------------------------------------------------
select is(
  (select count(*) from pg_constraint
   where conrelid = 'public.customer_recommendation_signals'::regclass
     and conname in ('customer_recommendation_signals_kind_check',
                     'customer_recommendation_signals_source_check',
                     'customer_recommendation_signals_link_account_fkey',
                     'customer_recommendation_signals_expiry_check')),
  4::bigint,
  'signal kind, source, account-scoped link, and expiry contracts exist');
select is(
  (select count(*) from pg_constraint
   where conrelid = 'public.customer_memory_briefs'::regclass
     and conname in ('customer_memory_briefs_link_account_fkey',
                     'customer_memory_briefs_source_check',
                     'customer_memory_briefs_expiry_check')),
  3::bigint,
  'brief link, source, and expiry contracts exist');
select is(
  (select count(*) from pg_constraint
   where conrelid = 'public.customer_personalization_settings'::regclass
     and conname in ('customer_personalization_settings_policy_version_check',
                     'customer_personalization_settings_actor_check',
                     'customer_personalization_settings_disabled_check')),
  3::bigint,
  'settings policy version, actor, and disabled contracts exist');
select ok(
  (select exists (select 1 from pg_trigger
                  where tgrelid = 'public.customer_recommendation_signals'::regclass
                    and tgname = 'customer_recommendation_signals_link_contract'
                    and not tgisinternal)),
  'signal verified AMIS link trigger is installed');
select ok(
  (select exists (select 1 from pg_trigger
                  where tgrelid = 'public.customer_personalization_settings'::regclass
                    and tgname = 'customer_personalization_settings_contract'
                    and not tgisinternal)),
  'settings verified AMIS link trigger is installed');

-- Canonical variant linkage --------------------------------------------------
select is(
  (select confrelid::regclass::text from pg_constraint
   where conrelid = 'public.customer_recommendation_signals'::regclass
     and contype = 'f'
     and conname = 'customer_recommendation_signals_variant_id_fkey'),
  'variants',
  'recommendation signals reference the canonical variant table');
select is(
  (select confrelid::regclass::text from pg_constraint
   where conrelid = 'public.variant_recommendation_features'::regclass
     and contype = 'f'
     and conname = 'variant_recommendation_features_variant_id_fkey'),
  'variants',
  'variant features reference the canonical variant table');

-- Behavioral history default -------------------------------------------------
select is(
  (select use_behavior_history from public.customer_personalization_settings
   where account_id = :'owner_account_id'::uuid),
  false,
  'behavioral history is off by default');
select is(
  (select use_amis_history from public.customer_personalization_settings
   where account_id = :'owner_account_id'::uuid),
  false,
  'AMIS history is off by default');
select is(
  (select recommendation_shadow_mode from public.customer_personalization_settings
   where account_id = :'owner_account_id'::uuid),
  true,
  'recommendation shadow mode is on by default');
select is(
  (select shadow_only from public.customer_recommendation_signals
   where account_id = :'owner_account_id'::uuid and signal_kind = 'purchased'),
  true,
  'recommendation signals default to shadow support');

-- Explicit exclusion and settings representation -----------------------------
select is(
  (select count(*) from public.customer_recommendation_signals
   where account_id = :'owner_account_id'::uuid and signal_kind = 'excluded'),
  1::bigint,
  'explicit exclusion is representable as an owned signal');
select is(
  (select count(*) from pg_constraint c
   where c.conrelid = 'public.customer_preferences'::regclass
     and c.conname = 'customer_preferences_feature_type_check'
     and pg_get_constraintdef(c.oid) like '%exclusion%'),
  1::bigint,
  'legacy explicit exclusion preference type is preserved');

-- Forbidden CRM mirrors ------------------------------------------------------
select is(
  (select count(*) from pg_attribute
   where attrelid in ('public.amis_contact_snapshots'::regclass,
                      'public.customer_memory_briefs'::regclass,
                      'public.customer_recommendation_signals'::regclass,
                      'public.variant_recommendation_features'::regclass,
                      'public.customer_personalization_settings'::regclass,
                      'public.customer_memory_projections'::regclass)
     and not attisdropped
     and attnum > 0
     and attname in ('note', 'notes', 'internal_note', 'internal_notes', 'internal_comment',
                     'debt', 'debt_amount', 'outstanding_debt', 'address', 'address_line1',
                     'billing_address', 'shipping_address', 'margin', 'margin_amount',
                     'margin_percent', 'cost_price', 'supplier_cost', 'email', 'phone',
                     'phone_number', 'tax_code')),
  0::bigint,
  'no forbidden CRM note, debt, address, margin, contact, or internal comment columns exist');
select is(
  (select count(*) from pg_attribute
   where attrelid = 'public.amis_contact_snapshots'::regclass
     and not attisdropped and attnum > 0
     and attname in ('contact_email', 'contact_phone', 'mobile', 'full_name')),
  0::bigint,
  'contact snapshots mirror identity only, not contact details');

-- Stale expiry contracts -----------------------------------------------------
select throws_ok(
  $$ insert into public.customer_recommendation_signals
       (account_id, variant_id, signal_kind, signal_source, expires_at, projection_version,
        first_observed_at)
     values ((select id from public.customer_accounts
              where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid),
             '00000000-0000-4000-8000-000000000034', 'session_interest', 'session_event',
             now() - interval '1 day', 'plan03.1', now()) $$,
  '23514',
  null,
  'a stale recommendation signal expiry is rejected');
select throws_ok(
  $$ update public.customer_memory_projections
     set expires_at = generated_at - interval '1 hour'
     where link_id = '00000000-0000-4000-8000-000000000811' $$,
  '23514',
  null,
  'a stale safe projection expiry is rejected');

-- Verified AMIS link and cross-account write denial ---------------------------
select throws_ok(
  $$ insert into public.customer_recommendation_signals
       (account_id, link_id, variant_id, signal_kind, signal_source, expires_at,
        projection_version)
     values ((select id from public.customer_accounts
              where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid),
             '00000000-0000-4000-8000-000000000812',
             '00000000-0000-4000-8000-000000000035', 'purchased', 'amis_sale_order',
             now() + interval '30 days', 'plan03.1') $$,
  'P0001',
  'personalization AMIS link must belong to the owning account',
  'a cross-account AMIS link on a recommendation signal is rejected');
select throws_ok(
  $$ insert into public.customer_memory_briefs
       (link_id, account_id, source, source_watermark, brief_version)
     values ('00000000-0000-4000-8000-000000000812',
             (select id from public.customer_accounts
              where legacy_supabase_user_id = '00000000-0000-4000-8000-000000000061'::uuid),
             'amis_custom_field', now(), 'plan03.1') $$,
  'P0001',
  'personalization AMIS link must belong to the owning account',
  'a cross-account brief link is rejected');
select throws_ok(
  $$ insert into public.customer_personalization_settings
       (account_id, policy_version, use_amis_history)
     values ('00000000-0000-4000-8000-000000000813', '2026-01-01', true) $$,
  'P0001',
  'personalization AMIS history requires a verified AMIS link',
  'AMIS history opt-in without a verified link is rejected');
select lives_ok(
  $$ update public.customer_personalization_settings
     set use_amis_history = true
     where account_id = (select id from public.customer_accounts
                         where legacy_supabase_user_id
                               = '00000000-0000-4000-8000-000000000061'::uuid) $$,
  'AMIS history opt-in succeeds for a verified linked owner');

-- Browser role denial on restricted raw tables --------------------------------
select is(has_table_privilege('anon', 'public.amis_contact_snapshots', 'select'), false,
  'anon cannot select restricted contact snapshots');
select is(has_table_privilege('authenticated', 'public.amis_contact_snapshots', 'select'), false,
  'authenticated cannot select restricted contact snapshots');
select is(has_table_privilege('authenticated', 'public.customer_memory_briefs', 'select'), false,
  'authenticated cannot select brief internals');
select is(has_table_privilege('anon', 'public.customer_memory_briefs', 'select'), false,
  'anon cannot select brief internals');
select is(has_table_privilege('authenticated', 'public.variant_recommendation_features', 'select'),
  false, 'authenticated cannot select raw variant features');
select is(has_table_privilege('authenticated', 'public.customer_recommendation_signals', 'select'),
  false, 'authenticated cannot select raw recommendation signals');
select is(has_table_privilege('authenticated', 'public.customer_personalization_settings', 'select'),
  false, 'authenticated cannot select raw settings rows');
select is(has_table_privilege('service_role', 'public.amis_contact_snapshots', 'select'), true,
  'service role retains restricted snapshot access');
select is(has_table_privilege('authenticated', 'public.customer_personalization_settings_safe',
  'select'), true, 'authenticated reads settings only through the safe view');
select is(
  (select count(*) from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('amis_contact_snapshots', 'customer_memory_briefs',
                     'customer_recommendation_signals', 'variant_recommendation_features',
                     'customer_personalization_settings')
     and relrowsecurity),
  5::bigint,
  'row level security is enabled on every new personalization table');

-- Owner isolation through safe surfaces ---------------------------------------
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000061',
    'role', 'authenticated',
    'iss', 'https://foundation.supabase.test/auth/v1',
    'aud', 'authenticated')::text,
  true);

select is(
  (select count(*) from public.customer_recommendation_signals_safe),
  2::bigint,
  'Customer A sees only its own recommendation signals');
select is(
  (select count(*) from public.customer_memory_projections_safe),
  1::bigint,
  'Customer A sees only its own safe memory projection');
select is(
  (select count(*) from public.customer_personalization_settings_safe),
  1::bigint,
  'Customer A sees only its own personalization settings');
select is(
  (select count(distinct account_id) from public.customer_recommendation_signals_safe
   where account_id <> (select public.current_customer_account_id())),
  0::bigint,
  'no cross-account signal rows leak through the safe view');

select set_config('request.jwt.claims', null, true);

-- Historical consent ledger retention -----------------------------------------
select is(
  (select count(*)::bigint from public.customer_consent_ledger),
  :'consent_history_before'::bigint,
  'the historical consent ledger rows are preserved unchanged');
select is(
  (select count(*) from pg_attribute
   where attrelid = 'public.customer_consent_ledger'::regclass
     and not attisdropped
     and attname in ('personalization', 'analytics', 'ai_processing', 'marketing',
                     'policy_version', 'withdrawn_at')),
  6::bigint,
  'consent ledger contract columns remain intact alongside the new settings table');
select has_table('public', 'customer_consent_current',
  'consent runtime projection is retained for shadow support');

select finish();

rollback;
