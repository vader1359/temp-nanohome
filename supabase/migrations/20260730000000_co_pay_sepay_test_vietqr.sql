begin;

-- Test Mode VietQR is intentionally sandbox-only. Store only the allowlisted
-- image endpoint; the API route adds the server-owned amount, reference, and
-- configured Test Mode bank account after validating the sandbox API response.
alter table public.payment_attempts
  add column provider_checkout_url text collate "C",
  add constraint payment_attempts_provider_checkout_url_check
    check (
      provider_checkout_url is null
      or provider_checkout_url = 'https://vietqr.app/img'
    );

create unique index payment_attempts_provider_order_id_unique
  on public.payment_attempts (provider collate "C", provider_order_id collate "C")
  where provider_order_id is not null;

-- The legacy two-argument RPC remains available for existing staging fixtures.
-- This overload binds browser idempotency and replaces the order-facing
-- WEB-* value with a VCB-compatible WEB + 12 alphanumeric payment code.
create or replace function public.create_customer_sepay_test_attempt(
  p_account_id uuid,
  p_order_id uuid,
  p_idempotency_key text
)
returns table (
  attempt_id uuid,
  merchant_reference text,
  amount numeric,
  currency text,
  attempt_state text,
  created boolean,
  provider_order_id text,
  provider_checkout_url text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_base record;
  v_attempt public.payment_attempts%rowtype;
  v_deterministic_key text := 'sepay-sandbox:' || p_order_id::text;
  v_payment_reference text;
begin
  if p_account_id is null
    or p_order_id is null
    or p_idempotency_key is null
    or octet_length(p_idempotency_key) not between 1 and 120
  then
    raise exception using errcode = 'P0001', message = 'sepay_test_attempt_invalid';
  end if;

  select *
  into v_base
  from public.create_customer_sepay_test_attempt(p_account_id, p_order_id);

  select attempt.*
  into v_attempt
  from public.payment_attempts attempt
  where attempt.id = v_base.attempt_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'sepay_test_attempt_not_found';
  end if;

  if v_attempt.idempotency_key = v_deterministic_key then
    update public.payment_attempts
    set idempotency_key = p_idempotency_key
    where id = v_attempt.id
    returning * into v_attempt;
  elsif v_attempt.idempotency_key <> p_idempotency_key then
    raise exception using errcode = 'P0001', message = 'sepay_test_attempt_idempotency_conflict';
  end if;

  if v_base.created then
    v_payment_reference := 'WEB'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    update public.payment_attempts
    set merchant_reference = v_payment_reference,
        provider_order_id = v_payment_reference,
        provider_checkout_url = 'https://vietqr.app/img',
        request_digest = encode(
          extensions.digest(
            concat_ws(
              '|',
              p_order_id::text,
              v_payment_reference,
              v_attempt.amount::text,
              v_attempt.currency
            ),
            'sha256'
          ),
          'hex'
        )
    where id = v_attempt.id
    returning * into v_attempt;
  elsif v_attempt.merchant_reference !~ '^WEB[A-Z0-9]{12}$'
    or v_attempt.provider_order_id is distinct from v_attempt.merchant_reference
    or v_attempt.provider_checkout_url is distinct from 'https://vietqr.app/img'
  then
    raise exception using
      errcode = 'P0001',
      message = 'sepay_test_attempt_reference_incompatible';
  end if;

  return query
    select
      v_attempt.id,
      v_attempt.merchant_reference,
      v_attempt.amount,
      v_attempt.currency,
      v_attempt.state,
      v_base.created,
      v_attempt.provider_order_id,
      v_attempt.provider_checkout_url,
      v_attempt.expires_at;
end;
$function$;

revoke all on function public.create_customer_sepay_test_attempt(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.create_customer_sepay_test_attempt(uuid, uuid, text)
to service_role;

comment on column public.payment_attempts.provider_checkout_url is
  'Server-owned provider handoff base URL; staging permits only Test Mode VietQR.';
comment on function public.create_customer_sepay_test_attempt(uuid, uuid, text) is
  'Creates or replays one account-owned SePay Test Mode attempt with a QR-safe payment code.';

commit;
