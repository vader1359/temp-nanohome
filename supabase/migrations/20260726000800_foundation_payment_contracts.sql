begin;

-- Plan 02 provider-neutral payment, reconciliation, and refund contracts.
-- Historical ZaloPay ledgers (`commerce_payment_ledger`, `commerce_refund_ledger`)
-- are left untouched; legacy identifiers stay nullable and are never synthesized
-- for a new provider. Evidence is digest-only: no raw provider payload is stored.

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete restrict,
  checkout_id uuid references public.commerce_checkouts(id) on delete restrict,
  provider text not null,
  payment_method text not null,
  merchant_reference text collate "C" not null,
  provider_order_id text collate "C",
  provider_transaction_id text collate "C",
  legacy_app_trans_id text collate "C",
  legacy_zp_trans_id text collate "C",
  idempotency_key text collate "C" not null,
  amount numeric(15,2) not null,
  currency text not null default 'VND',
  state text not null default 'created',
  request_digest text collate "C",
  response_digest text collate "C",
  created_at timestamptz not null default now(),
  retrieved_at timestamptz,
  expires_at timestamptz,
  constraint payment_attempts_order_link_check
    check (order_id is not null or checkout_id is not null),
  constraint payment_attempts_provider_check
    check (provider in ('sepay', 'zalopay', 'manual')),
  constraint payment_attempts_payment_method_check
    check (payment_method in ('bank_transfer', 'qr_transfer', 'wallet', 'card', 'cash_on_delivery')),
  constraint payment_attempts_state_check
    check (state in ('created', 'pending', 'authorized', 'succeeded', 'failed', 'expired', 'cancelled')),
  constraint payment_attempts_amount_check check (amount > 0),
  constraint payment_attempts_currency_check check (currency = 'VND'),
  constraint payment_attempts_merchant_reference_nonempty
    check (octet_length(merchant_reference) > 0),
  constraint payment_attempts_idempotency_key_nonempty
    check (octet_length(idempotency_key) > 0),
  constraint payment_attempts_provider_order_id_nonempty
    check (provider_order_id is null or octet_length(provider_order_id) > 0),
  constraint payment_attempts_provider_transaction_id_nonempty
    check (provider_transaction_id is null or octet_length(provider_transaction_id) > 0),
  constraint payment_attempts_request_digest_shape
    check (request_digest is null or request_digest ~ '^[0-9a-f]{64}$'),
  constraint payment_attempts_response_digest_shape
    check (response_digest is null or response_digest ~ '^[0-9a-f]{64}$'),
  constraint payment_attempts_expiry_window
    check (expires_at is null or expires_at > created_at),
  -- Legacy ZaloPay identifiers only ever belong to a ZaloPay attempt; they are
  -- never synthesized onto a SePay or manual attempt.
  constraint payment_attempts_legacy_identifier_provider_check check (
    provider = 'zalopay'
    or (legacy_app_trans_id is null and legacy_zp_trans_id is null)
  ),
  constraint payment_attempts_legacy_app_trans_id_nonempty
    check (legacy_app_trans_id is null or octet_length(legacy_app_trans_id) > 0),
  constraint payment_attempts_legacy_zp_trans_id_nonempty
    check (legacy_zp_trans_id is null or octet_length(legacy_zp_trans_id) > 0)
);

create unique index payment_attempts_provider_merchant_reference_unique
  on public.payment_attempts (provider collate "C", merchant_reference collate "C");
create unique index payment_attempts_provider_idempotency_key_unique
  on public.payment_attempts (provider collate "C", idempotency_key collate "C");
create unique index payment_attempts_provider_transaction_id_unique
  on public.payment_attempts (provider collate "C", provider_transaction_id collate "C")
  where provider_transaction_id is not null;
create index payment_attempts_order_idx
  on public.payment_attempts (order_id) where order_id is not null;
create index payment_attempts_checkout_idx
  on public.payment_attempts (checkout_id) where checkout_id is not null;

create table public.payment_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  provider text not null,
  provider_event_id text collate "C" not null,
  provider_transaction_id text collate "C",
  event_type text not null,
  from_state text not null,
  to_state text not null,
  verification_decision text not null,
  transition_decision text not null,
  payload_digest text collate "C" not null,
  received_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  constraint payment_events_provider_check
    check (provider in ('sepay', 'zalopay', 'manual')),
  constraint payment_events_event_type_check
    check (event_type in ('created', 'pending', 'authorized', 'succeeded', 'failed', 'expired', 'cancelled')),
  constraint payment_events_from_state_check
    check (from_state in ('created', 'pending', 'authorized', 'succeeded', 'failed', 'expired', 'cancelled')),
  constraint payment_events_to_state_check
    check (to_state in ('created', 'pending', 'authorized', 'succeeded', 'failed', 'expired', 'cancelled')),
  constraint payment_events_verification_decision_check
    check (verification_decision in ('verified', 'unverified', 'rejected')),
  constraint payment_events_transition_decision_check
    check (transition_decision in ('applied', 'ignored_duplicate', 'ignored_stale', 'rejected')),
  constraint payment_events_payload_digest_shape
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint payment_events_provider_event_id_nonempty
    check (octet_length(provider_event_id) > 0),
  constraint payment_events_applied_requires_verification
    check (transition_decision <> 'applied' or verification_decision = 'verified'),
  constraint payment_events_provider_event_identity
    unique (provider, provider_event_id)
);

create index payment_events_attempt_idx on public.payment_events (attempt_id, recorded_at);

create table public.payment_reconciliations (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  queried_at timestamptz not null default now(),
  provider_status text collate "C" not null,
  response_digest text collate "C" not null,
  decision text not null,
  recorded_at timestamptz not null default now(),
  constraint payment_reconciliations_provider_status_nonempty
    check (octet_length(provider_status) > 0),
  constraint payment_reconciliations_response_digest_shape
    check (response_digest ~ '^[0-9a-f]{64}$'),
  constraint payment_reconciliations_decision_check
    check (decision in ('match', 'mismatch', 'pending', 'unknown'))
);

create index payment_reconciliations_attempt_idx
  on public.payment_reconciliations (attempt_id, queried_at);

create table public.refund_operations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete restrict,
  checkout_id uuid references public.commerce_checkouts(id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  method text not null,
  state text not null default 'requested',
  amount numeric(15,2) not null,
  currency text not null default 'VND',
  reason text not null,
  idempotency_key text collate "C" not null,
  requested_by text not null,
  approved_by text,
  completed_by text,
  bank_evidence_reference text collate "C",
  bank_evidence_digest text collate "C",
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  completed_at timestamptz,
  constraint refund_operations_order_link_check
    check (order_id is not null or checkout_id is not null or payment_attempt_id is not null),
  constraint refund_operations_method_check
    check (method in ('manual_bank_transfer', 'provider_void')),
  constraint refund_operations_state_check
    check (state in ('requested', 'approved', 'completed', 'rejected', 'failed')),
  constraint refund_operations_amount_check check (amount > 0),
  constraint refund_operations_currency_check check (currency = 'VND'),
  constraint refund_operations_reason_nonempty check (octet_length(reason) > 0),
  constraint refund_operations_idempotency_key_nonempty check (octet_length(idempotency_key) > 0),
  constraint refund_operations_requested_by_nonempty check (octet_length(requested_by) > 0),
  constraint refund_operations_bank_evidence_digest_shape
    check (bank_evidence_digest is null or bank_evidence_digest ~ '^[0-9a-f]{64}$'),
  -- A manual bank refund needs two distinct actors and digest-only bank evidence.
  constraint refund_operations_manual_dual_actor_check check (
    method <> 'manual_bank_transfer'
    or state not in ('approved', 'completed')
    or (
      approved_by is not null
      and approved_by is distinct from requested_by
      and approved_at is not null
    )
  ),
  constraint refund_operations_manual_evidence_check check (
    method <> 'manual_bank_transfer'
    or state <> 'completed'
    or (
      completed_by is not null
      and completed_at is not null
      and bank_evidence_reference is not null
      and bank_evidence_digest is not null
    )
  )
);

create unique index refund_operations_idempotency_key_unique
  on public.refund_operations (idempotency_key collate "C");
create index refund_operations_order_idx
  on public.refund_operations (order_id) where order_id is not null;
create index refund_operations_payment_attempt_idx
  on public.refund_operations (payment_attempt_id) where payment_attempt_id is not null;

create table public.refund_events (
  id bigint generated always as identity primary key,
  refund_operation_id uuid not null references public.refund_operations(id) on delete restrict,
  event_type text not null,
  from_state text not null,
  to_state text not null,
  transition_decision text not null,
  actor text not null,
  payload_digest text collate "C",
  recorded_at timestamptz not null default now(),
  constraint refund_events_event_type_check
    check (event_type in ('requested', 'approved', 'completed', 'rejected', 'failed')),
  constraint refund_events_from_state_check
    check (from_state in ('requested', 'approved', 'completed', 'rejected', 'failed')),
  constraint refund_events_to_state_check
    check (to_state in ('requested', 'approved', 'completed', 'rejected', 'failed')),
  constraint refund_events_transition_decision_check
    check (transition_decision in ('applied', 'ignored_duplicate', 'ignored_stale', 'rejected')),
  constraint refund_events_actor_nonempty check (octet_length(actor) > 0),
  constraint refund_events_payload_digest_shape
    check (payload_digest is null or payload_digest ~ '^[0-9a-f]{64}$')
);

create index refund_events_operation_idx
  on public.refund_events (refund_operation_id, recorded_at);

create or replace function public.payment_prevent_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  raise exception using errcode = 'P0001', message = 'payment ledger is append-only';
end;
$function$;

drop trigger if exists payment_events_append_only on public.payment_events;
create trigger payment_events_append_only
  before update or delete on public.payment_events
  for each row execute function public.payment_prevent_mutation();

drop trigger if exists payment_reconciliations_append_only on public.payment_reconciliations;
create trigger payment_reconciliations_append_only
  before update or delete on public.payment_reconciliations
  for each row execute function public.payment_prevent_mutation();

drop trigger if exists refund_events_append_only on public.refund_events;
create trigger refund_events_append_only
  before update or delete on public.refund_events
  for each row execute function public.payment_prevent_mutation();

-- An applied provider event must belong to the attempt's provider and describe a
-- legal forward transition from the attempt's current state.
create or replace function public.enforce_payment_event_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  attempt_provider text;
  attempt_state text;
begin
  select provider, state
  into attempt_provider, attempt_state
  from public.payment_attempts
  where id = new.attempt_id
  for update;

  if new.provider is distinct from attempt_provider then
    raise exception 'payment event provider must match the payment attempt provider'
      using errcode = 'P0001';
  end if;

  if new.transition_decision <> 'applied' then
    return new;
  end if;

  if new.from_state is distinct from attempt_state then
    raise exception 'payment transition is not allowed'
      using errcode = 'P0001';
  end if;

  if not (
    (new.from_state = 'created' and new.to_state in ('pending', 'authorized', 'succeeded', 'failed', 'expired', 'cancelled'))
    or (new.from_state = 'pending' and new.to_state in ('authorized', 'succeeded', 'failed', 'expired', 'cancelled'))
    or (new.from_state = 'authorized' and new.to_state in ('succeeded', 'failed', 'cancelled'))
  ) then
    raise exception 'payment transition is not allowed'
      using errcode = 'P0001';
  end if;

  update public.payment_attempts
  set state = new.to_state,
      provider_transaction_id = coalesce(new.provider_transaction_id, provider_transaction_id),
      retrieved_at = now()
  where id = new.attempt_id;

  return new;
end;
$function$;

drop trigger if exists enforce_payment_event_transition on public.payment_events;
create trigger enforce_payment_event_transition
  before insert on public.payment_events
  for each row execute function public.enforce_payment_event_transition();

alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_reconciliations enable row level security;
alter table public.refund_operations enable row level security;
alter table public.refund_events enable row level security;

revoke all on public.payment_attempts, public.payment_events,
  public.payment_reconciliations, public.refund_operations, public.refund_events
  from public, anon, authenticated;
revoke all on function public.payment_prevent_mutation() from public, anon, authenticated;
revoke all on function public.enforce_payment_event_transition() from public, anon, authenticated;

grant all on public.payment_attempts, public.payment_events,
  public.payment_reconciliations, public.refund_operations, public.refund_events
  to service_role;
grant usage, select on sequence public.payment_events_id_seq,
  public.payment_reconciliations_id_seq, public.refund_events_id_seq to service_role;

comment on table public.payment_attempts is 'Provider-neutral payment attempt bound to an immutable order or checkout record.';
comment on column public.payment_attempts.legacy_app_trans_id is 'Historical ZaloPay app_trans_id; nullable and never synthesized for another provider.';
comment on column public.payment_attempts.legacy_zp_trans_id is 'Historical ZaloPay zp_trans_id; nullable and never synthesized for another provider.';
comment on table public.payment_events is 'Append-only provider event ledger holding digest-only evidence and transition decisions.';
comment on column public.payment_events.payload_digest is 'SHA-256 digest of the provider payload; raw provider payloads are never stored.';
comment on table public.payment_reconciliations is 'Append-only reconciliation queries storing a safe provider status and a response digest.';
comment on table public.refund_operations is 'Refund requests; a manual bank refund requires two distinct actors and digest-only bank evidence.';
comment on table public.refund_events is 'Append-only refund transition history.';

commit;
