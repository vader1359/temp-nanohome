create table public.email_link_recovery_transactions (
  state_digest text primary key
    check (state_digest ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);

alter table public.email_link_recovery_transactions enable row level security;

revoke all on table public.email_link_recovery_transactions from public, anon, authenticated;

create function public.begin_email_link_recovery_transaction(
  p_state_digest text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_state_digest is null
    or p_state_digest !~ '^[A-Za-z0-9_-]{43}$'
    or p_expires_at is null
    or p_expires_at <= v_now
    or p_expires_at > v_now + interval '20 minutes'
  then
    return false;
  end if;

  delete from public.email_link_recovery_transactions
  where expires_at < v_now - interval '1 day';

  insert into public.email_link_recovery_transactions (
    state_digest,
    created_at,
    expires_at
  )
  values (
    p_state_digest,
    v_now,
    p_expires_at
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

create function public.inspect_email_link_recovery_transaction(
  p_state_digest text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_consumed_at timestamptz;
  v_expires_at timestamptz;
begin
  if p_state_digest is null or p_state_digest !~ '^[A-Za-z0-9_-]{43}$' then
    return 'invalid';
  end if;

  select recovery.consumed_at, recovery.expires_at
  into v_consumed_at, v_expires_at
  from public.email_link_recovery_transactions recovery
  where recovery.state_digest = p_state_digest;

  if not found then
    return 'invalid';
  end if;
  if v_consumed_at is not null then
    return 'replayed';
  end if;
  if v_expires_at <= clock_timestamp() then
    return 'expired';
  end if;
  return 'valid';
end;
$$;

create function public.consume_email_link_recovery_transaction(
  p_state_digest text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_consumed_digest text;
  v_now timestamptz := clock_timestamp();
begin
  if p_state_digest is null or p_state_digest !~ '^[A-Za-z0-9_-]{43}$' then
    return 'invalid';
  end if;

  update public.email_link_recovery_transactions recovery
  set consumed_at = v_now
  where recovery.state_digest = p_state_digest
    and recovery.consumed_at is null
    and recovery.expires_at > v_now
  returning recovery.state_digest into v_consumed_digest;

  if found then
    return 'consumed';
  end if;

  return public.inspect_email_link_recovery_transaction(p_state_digest);
end;
$$;

revoke all on function public.begin_email_link_recovery_transaction(text, timestamptz) from public, anon, authenticated;
revoke all on function public.inspect_email_link_recovery_transaction(text) from public, anon, authenticated;
revoke all on function public.consume_email_link_recovery_transaction(text) from public, anon, authenticated;

grant execute on function public.begin_email_link_recovery_transaction(text, timestamptz) to service_role;
grant execute on function public.inspect_email_link_recovery_transaction(text) to service_role;
grant execute on function public.consume_email_link_recovery_transaction(text) to service_role;

comment on table public.email_link_recovery_transactions is
  'Opaque HMAC state digests for short-lived, one-time Firebase email-link recovery. Raw state and identity data are never stored.';
comment on function public.consume_email_link_recovery_transaction(text) is
  'Atomically consumes one recovery state digest; concurrent or later calls return replayed.';
