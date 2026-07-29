begin;

alter table public.orders
  add column checkout_request_digest text collate "C",
  add constraint orders_checkout_request_digest_shape
    check (
      checkout_request_digest is null
      or checkout_request_digest ~ '^[0-9a-f]{64}$'
    );

alter table public.payment_attempts
  add column provider_environment text not null default 'primary',
  add constraint payment_attempts_provider_environment_check
    check (provider_environment in ('sandbox', 'primary'));

create index payment_attempts_sepay_sandbox_reference_idx
  on public.payment_attempts (merchant_reference collate "C")
  where provider = 'sepay' and provider_environment = 'sandbox';

create or replace function public.capture_customer_account_order(
  p_account_id uuid,
  p_idempotency_key text,
  p_request_digest text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_city text default null,
  p_district text default null,
  p_ward text default null,
  p_note text default null
)
returns table (
  order_id uuid,
  order_number text,
  merchant_reference text,
  amount numeric,
  currency text,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_cart_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_merchant_reference text;
  v_amount numeric(15,2);
  v_currency text;
  v_price_snapshot jsonb;
  v_existing_digest text;
begin
  if p_account_id is null
    or p_idempotency_key is null
    or octet_length(p_idempotency_key) not between 1 and 120
    or p_request_digest is null
    or p_request_digest !~ '^[0-9a-f]{64}$'
    or p_full_name is null
    or char_length(btrim(p_full_name)) not between 1 and 200
    or p_email is null
    or char_length(btrim(p_email)) not between 1 and 320
    or btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or p_phone is null
    or char_length(btrim(p_phone)) not between 1 and 50
    or p_address is null
    or char_length(btrim(p_address)) not between 1 and 500
    or (p_city is not null and char_length(btrim(p_city)) not between 1 and 100)
    or (p_district is not null and char_length(btrim(p_district)) not between 1 and 100)
    or (p_ward is not null and char_length(btrim(p_ward)) not between 1 and 100)
    or (p_note is not null and char_length(btrim(p_note)) not between 1 and 1000)
  then
    raise exception using errcode = 'P0001', message = 'checkout_invalid_request';
  end if;

  if not exists (
    select 1
    from public.customer_accounts account
    where account.id = p_account_id and account.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'checkout_unauthorized';
  end if;

  -- Serialize against account-cart mutation/merge and duplicate checkout retry.
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));

  select
    customer_order.id,
    customer_order.order_number,
    customer_order.web_order_number,
    customer_order.grand_total,
    customer_order.currency,
    customer_order.checkout_request_digest
  into
    v_order_id,
    v_order_number,
    v_merchant_reference,
    v_amount,
    v_currency,
    v_existing_digest
  from public.orders customer_order
  where customer_order.account_id = p_account_id
    and customer_order.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_digest is distinct from p_request_digest then
      raise exception using errcode = 'P0001', message = 'checkout_idempotency_conflict';
    end if;
    return query
      select v_order_id, v_order_number, v_merchant_reference, v_amount, v_currency, true;
    return;
  end if;

  select cart.id
  into v_cart_id
  from public.carts cart
  where cart.account_id = p_account_id
  for update;

  if v_cart_id is null then
    raise exception using errcode = 'P0001', message = 'checkout_cart_not_found';
  end if;

  perform 1
  from public.cart_items item
  where item.cart_id = v_cart_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'checkout_empty_cart';
  end if;

  if exists (
    select 1
    from public.cart_items item
    left join public.catalog_eligibility eligibility
      on eligibility.variant_id = item.variant_id
    where item.cart_id = v_cart_id
      and (
        eligibility.variant_id is null
        or eligibility.payment is not true
        or eligibility.price is null
        or eligibility.stock is null
        or eligibility.stock < item.quantity
      )
  ) then
    raise exception using errcode = 'P0001', message = 'checkout_invalid_cart';
  end if;

  select
    sum(eligibility.price * item.quantity),
    jsonb_agg(
      jsonb_build_object(
        'variantId', eligibility.variant_id,
        'sku', eligibility.sku,
        'unitPrice', eligibility.price,
        'quantity', item.quantity,
        'currency', 'VND'
      )
      order by eligibility.variant_id
    )
  into v_amount, v_price_snapshot
  from public.cart_items item
  join public.catalog_eligibility eligibility
    on eligibility.variant_id = item.variant_id
  where item.cart_id = v_cart_id;

  if v_amount is null or v_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'checkout_invalid_cart';
  end if;

  v_order_number := concat(
    'ORD-',
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    '-',
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
  );
  v_merchant_reference := 'WEB-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
  v_currency := 'VND';

  insert into public.orders (
    order_number,
    web_order_number,
    account_id,
    owner_scope,
    order_kind,
    idempotency_key,
    checkout_request_digest,
    email,
    full_name,
    phone,
    address,
    city,
    district,
    ward,
    note,
    subtotal,
    grand_total,
    currency,
    price_snapshot,
    status,
    business_status,
    payment_status
  ) values (
    v_order_number,
    v_merchant_reference,
    p_account_id,
    'auth',
    'paid_order',
    p_idempotency_key,
    p_request_digest,
    btrim(p_email),
    btrim(p_full_name),
    btrim(p_phone),
    btrim(p_address),
    nullif(btrim(p_city), ''),
    nullif(btrim(p_district), ''),
    nullif(btrim(p_ward), ''),
    nullif(btrim(p_note), ''),
    v_amount,
    v_amount,
    v_currency,
    v_price_snapshot,
    'pending',
    'created',
    'unpaid'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    variant_id,
    product_name,
    variant_name,
    sku,
    price,
    quantity
  )
  select
    v_order_id,
    eligibility.variant_id,
    eligibility.localized_product_name,
    eligibility.localized_name,
    eligibility.sku,
    eligibility.price,
    item.quantity
  from public.cart_items item
  join public.catalog_eligibility eligibility
    on eligibility.variant_id = item.variant_id
  where item.cart_id = v_cart_id;

  insert into public.order_status_history (
    order_id,
    status,
    actor_kind,
    actor_account_id
  ) values (
    v_order_id,
    'pending',
    'account',
    p_account_id
  );

  delete from public.cart_items item where item.cart_id = v_cart_id;
  update public.carts set version = version + 1 where id = v_cart_id;

  return query
    select v_order_id, v_order_number, v_merchant_reference, v_amount, v_currency, false;
end;
$function$;

create or replace function public.create_customer_sepay_test_attempt(
  p_account_id uuid,
  p_order_id uuid
)
returns table (
  attempt_id uuid,
  merchant_reference text,
  amount numeric,
  currency text,
  attempt_state text,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_attempt_id uuid;
  v_merchant_reference text;
  v_amount numeric(15,2);
  v_currency text;
  v_attempt_state text;
  v_payment_status text;
begin
  if p_account_id is null or p_order_id is null then
    raise exception using errcode = 'P0001', message = 'sepay_test_attempt_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_order_id::text, 1));

  select
    customer_order.web_order_number,
    customer_order.grand_total,
    customer_order.currency,
    customer_order.payment_status
  into
    v_merchant_reference,
    v_amount,
    v_currency,
    v_payment_status
  from public.orders customer_order
  join public.customer_accounts account
    on account.id = customer_order.account_id and account.state = 'active'
  where customer_order.id = p_order_id
    and customer_order.account_id = p_account_id
    and customer_order.owner_scope = 'auth'
    and customer_order.order_kind = 'paid_order'
    and customer_order.business_status not in ('cancelled', 'fulfilled')
  for update of customer_order;

  if not found then
    raise exception using errcode = 'P0001', message = 'sepay_test_order_not_found';
  end if;

  select attempt.id, attempt.state
  into v_attempt_id, v_attempt_state
  from public.payment_attempts attempt
  where attempt.order_id = p_order_id
    and attempt.provider = 'sepay'
    and attempt.provider_environment = 'sandbox'
  limit 1
  for update;

  if found then
    return query
      select v_attempt_id, v_merchant_reference, v_amount, v_currency, v_attempt_state, false;
    return;
  end if;

  if v_payment_status <> 'unpaid'
    or v_currency <> 'VND'
    or v_amount is null
    or v_amount <= 0
  then
    raise exception using errcode = 'P0001', message = 'sepay_test_order_not_payable';
  end if;

  insert into public.payment_attempts (
    order_id,
    provider,
    provider_environment,
    payment_method,
    merchant_reference,
    idempotency_key,
    amount,
    currency,
    state,
    request_digest,
    expires_at
  ) values (
    p_order_id,
    'sepay',
    'sandbox',
    'bank_transfer',
    v_merchant_reference,
    'sepay-sandbox:' || p_order_id::text,
    v_amount,
    v_currency,
    'pending',
    encode(
      extensions.digest(
        concat_ws('|', p_order_id::text, v_merchant_reference, v_amount::text, v_currency),
        'sha256'
      ),
      'hex'
    ),
    now() + interval '24 hours'
  )
  returning id, state into v_attempt_id, v_attempt_state;

  return query
    select v_attempt_id, v_merchant_reference, v_amount, v_currency, v_attempt_state, true;
end;
$function$;

create or replace function public.apply_sepay_test_ipn(
  p_merchant_reference text,
  p_provider_event_id text,
  p_provider_transaction_id text,
  p_amount bigint,
  p_payload_digest text,
  p_received_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_attempt public.payment_attempts%rowtype;
  v_event public.payment_events%rowtype;
  v_order_payment_status text;
begin
  if p_merchant_reference is null
    or octet_length(p_merchant_reference) not between 1 and 256
    or p_provider_event_id is null
    or octet_length(p_provider_event_id) not between 1 and 256
    or p_provider_transaction_id is null
    or octet_length(p_provider_transaction_id) not between 1 and 256
    or p_amount is null
    or p_amount <= 0
    or p_payload_digest is null
    or p_payload_digest !~ '^[0-9a-f]{64}$'
    or p_received_at is null
  then
    return 'rejected';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider_transaction_id, 2));

  select attempt.*
  into v_attempt
  from public.payment_attempts attempt
  where attempt.provider = 'sepay'
    and attempt.provider_environment = 'sandbox'
    and attempt.merchant_reference = p_merchant_reference
    and attempt.amount = p_amount
    and attempt.currency = 'VND'
  for update;

  if not found then return 'not_found'; end if;

  select event.*
  into v_event
  from public.payment_events event
  where event.provider = 'sepay'
    and event.provider_event_id = 'sandbox:' || p_provider_event_id;

  if found then
    if v_event.attempt_id = v_attempt.id
      and v_event.provider_transaction_id = p_provider_transaction_id
      and v_event.payload_digest = p_payload_digest
    then
      return 'duplicate';
    end if;
    return 'conflict';
  end if;

  if exists (
    select 1
    from public.payment_attempts other_attempt
    where other_attempt.provider = 'sepay'
      and other_attempt.provider_transaction_id = p_provider_transaction_id
      and other_attempt.id <> v_attempt.id
  ) then
    return 'conflict';
  end if;

  select customer_order.payment_status
  into v_order_payment_status
  from public.orders customer_order
  where customer_order.id = v_attempt.order_id
  for update;

  if v_attempt.state = 'succeeded' and v_order_payment_status = 'paid' then
    if v_attempt.provider_transaction_id = p_provider_transaction_id then
      insert into public.payment_events (
        attempt_id,
        provider,
        provider_event_id,
        provider_transaction_id,
        event_type,
        from_state,
        to_state,
        verification_decision,
        transition_decision,
        payload_digest,
        received_at
      ) values (
        v_attempt.id,
        'sepay',
        'sandbox:' || p_provider_event_id,
        p_provider_transaction_id,
        'succeeded',
        'succeeded',
        'succeeded',
        'verified',
        'ignored_duplicate',
        p_payload_digest,
        p_received_at
      );
      return 'duplicate';
    end if;
    return 'conflict';
  end if;

  if v_attempt.state not in ('created', 'pending', 'authorized')
    or v_order_payment_status <> 'unpaid'
  then
    return 'conflict';
  end if;

  insert into public.payment_events (
    attempt_id,
    provider,
    provider_event_id,
    provider_transaction_id,
    event_type,
    from_state,
    to_state,
    verification_decision,
    transition_decision,
    payload_digest,
    received_at
  ) values (
    v_attempt.id,
    'sepay',
    'sandbox:' || p_provider_event_id,
    p_provider_transaction_id,
    'succeeded',
    v_attempt.state,
    'succeeded',
    'verified',
    'applied',
    p_payload_digest,
    p_received_at
  );

  update public.orders
  set payment_status = 'paid'
  where id = v_attempt.order_id
    and payment_status = 'unpaid';

  if not found then return 'conflict'; end if;
  return 'applied';
end;
$function$;

revoke all on function public.capture_customer_account_order(
  uuid, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.capture_customer_account_order(
  uuid, text, text, text, text, text, text, text, text, text, text
) to service_role;

revoke all on function public.create_customer_sepay_test_attempt(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.create_customer_sepay_test_attempt(uuid, uuid)
to service_role;

revoke all on function public.apply_sepay_test_ipn(text, text, text, bigint, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.apply_sepay_test_ipn(text, text, text, bigint, text, timestamptz)
to service_role;

comment on column public.orders.checkout_request_digest is
  'Server-computed digest used to reject mismatched checkout idempotency retries.';
comment on column public.payment_attempts.provider_environment is
  'Explicit provider trust boundary; AI Commerce staging creates only sandbox attempts.';
comment on function public.apply_sepay_test_ipn(text, text, text, bigint, text, timestamptz) is
  'Applies one verified SePay sandbox inbound transfer using digest-only evidence.';

commit;
