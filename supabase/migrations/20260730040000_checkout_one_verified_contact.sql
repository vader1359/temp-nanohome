begin;

-- Preserve the audited claim implementation and wrap only its checkout
-- readiness projection. The underlying function still persists exclusively
-- Firebase-verified factors in customer_account_verified_identities.
alter function public.claim_customer_account_precreation(
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb
)
rename to claim_customer_account_precreation_both_verified_v1;

revoke all on function public.claim_customer_account_precreation_both_verified_v1(
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb
)
from public, anon, authenticated, service_role;

create function public.claim_customer_account_precreation(
  p_firebase_uid text,
  p_phone_lookup_digest text,
  p_email_lookup_digest text,
  p_phone_verified boolean,
  p_email_verified boolean,
  p_policy_acceptances jsonb default '[]'::jsonb
)
returns table(
  claim_status text,
  account_id uuid,
  phone_verified boolean,
  email_verified boolean,
  checkout_ready boolean
)
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select
    claim.claim_status,
    claim.account_id,
    claim.phone_verified,
    claim.email_verified,
    claim.phone_verified or claim.email_verified
  from public.claim_customer_account_precreation_both_verified_v1(
    p_firebase_uid,
    p_phone_lookup_digest,
    p_email_lookup_digest,
    p_phone_verified,
    p_email_verified,
    p_policy_acceptances
  ) claim;
$function$;

create or replace function public.customer_account_identity_assurance(
  p_firebase_uid text
)
returns table(
  account_id uuid,
  registration_claimed boolean,
  phone_verified boolean,
  email_verified boolean,
  checkout_ready boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    principal.account_id,
    true,
    assurance.phone_verified,
    assurance.email_verified,
    assurance.phone_verified or assurance.email_verified
  from public.customer_firebase_principals principal
  join public.customer_accounts account
    on account.id = principal.account_id
   and account.state = 'active'
  cross join lateral (
    select
      exists (
        select 1
        from public.customer_account_verified_identities verified_identity
        where verified_identity.account_id = principal.account_id
          and verified_identity.kind = 'phone'
          and verified_identity.status = 'active'
      ) as phone_verified,
      exists (
        select 1
        from public.customer_account_verified_identities verified_identity
        where verified_identity.account_id = principal.account_id
          and verified_identity.kind = 'email'
          and verified_identity.status = 'active'
      ) as email_verified
  ) assurance
  where principal.firebase_uid = btrim(p_firebase_uid)
    and principal.status = 'active'
  limit 1;
$function$;

revoke all on function public.claim_customer_account_precreation(
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb
)
from public, anon, authenticated;
revoke all on function public.customer_account_identity_assurance(text)
from public, anon, authenticated;

grant execute on function public.claim_customer_account_precreation(
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb
)
to service_role;
grant execute on function public.customer_account_identity_assurance(text)
to service_role;

comment on function public.claim_customer_account_precreation(
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb
) is
  'Claims with one or more Firebase-verified factors; checkout readiness requires either verified phone or verified email.';
comment on function public.claim_customer_account_precreation_both_verified_v1(
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb
) is
  'Internal pre-20260730040000 claim implementation; direct execution is revoked and checkout readiness is superseded by the public wrapper.';
comment on function public.customer_account_identity_assurance(text) is
  'Service-role-only assurance: one verified phone or email identity is sufficient for checkout; both order contacts remain required by checkout capture.';

commit;
