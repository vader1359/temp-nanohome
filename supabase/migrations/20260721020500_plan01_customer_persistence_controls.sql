create or replace function public.refresh_customer_consent_current()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_consent_current (
    visitor_id, consent_ledger_id, policy_version, locale, source, actor,
    analytics, personalization, ai_processing, ai_conversation_storage,
    room_image_processing, room_image_storage, marketing, withdrawn_at, withdrawal_reason,
    recorded_at
  ) values (
    new.visitor_id, new.id, new.policy_version, new.locale, new.source, new.actor,
    new.analytics, new.personalization, new.ai_processing, new.ai_conversation_storage,
    new.room_image_processing, new.room_image_storage, new.marketing, new.withdrawn_at,
    new.withdrawal_reason, new.recorded_at
  )
  on conflict (visitor_id) do update set
    consent_ledger_id = excluded.consent_ledger_id,
    policy_version = excluded.policy_version,
    locale = excluded.locale,
    source = excluded.source,
    actor = excluded.actor,
    analytics = excluded.analytics,
    personalization = excluded.personalization,
    ai_processing = excluded.ai_processing,
    ai_conversation_storage = excluded.ai_conversation_storage,
    room_image_processing = excluded.room_image_processing,
    room_image_storage = excluded.room_image_storage,
    marketing = excluded.marketing,
    withdrawn_at = excluded.withdrawn_at,
    withdrawal_reason = excluded.withdrawal_reason,
    recorded_at = excluded.recorded_at
  where (excluded.recorded_at, excluded.consent_ledger_id) >
    (public.customer_consent_current.recorded_at,
      public.customer_consent_current.consent_ledger_id);
  return new;
end;
$$;

create trigger customer_consent_current_refresh
after insert on public.customer_consent_ledger
for each row execute function public.refresh_customer_consent_current();

create or replace function public.prevent_customer_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('customer_data.deletion', true) = 'on' and tg_op = 'DELETE' then
    return old;
  end if;
  raise exception 'customer ledgers are append-only';
end;
$$;

create trigger customer_identity_ledger_append_only
before update or delete on public.customer_identity_ledger
for each row execute function public.prevent_customer_ledger_mutation();

create trigger customer_consent_ledger_append_only
before update or delete on public.customer_consent_ledger
for each row execute function public.prevent_customer_ledger_mutation();

create table public.customer_subject_deletion_queue (
  id bigint generated always as identity primary key,
  visitor_id uuid not null references public.customer_visitors(id) on delete cascade,
  requested_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone,
  check (processed_at is null or processed_at >= requested_at)
);

create index customer_subject_deletion_queue_pending_idx
  on public.customer_subject_deletion_queue(id) where processed_at is null;

create or replace function public.process_customer_subject_deletion(
  p_queue_id bigint,
  p_batch_size integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visitor_id uuid;
  v_deleted integer := 0;
begin
  if p_batch_size not between 1 and 1000 then
    raise exception 'p_batch_size must be between 1 and 1000';
  end if;

  select visitor_id into v_visitor_id
  from public.customer_subject_deletion_queue
  where id = p_queue_id and processed_at is null
  for update;

  if v_visitor_id is null then
    return 0;
  end if;

  perform set_config('customer_data.deletion', 'on', true);
  delete from public.customer_events where visitor_id = v_visitor_id;
  get diagnostics v_deleted = row_count;
  delete from public.customer_consent_current where visitor_id = v_visitor_id;
  delete from public.customer_identity_ledger where visitor_id = v_visitor_id;
  delete from public.customer_consent_ledger where visitor_id = v_visitor_id;
  delete from public.customer_subject_deletion_queue where id = p_queue_id;
  delete from public.customer_visitors where id = v_visitor_id;
  return v_deleted;
end;
$$;

alter table public.customer_visitors enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.customer_identity_ledger enable row level security;
alter table public.customer_consent_ledger enable row level security;
alter table public.customer_consent_current enable row level security;
alter table public.customer_events enable row level security;
alter table public.customer_event_daily_aggregates enable row level security;
alter table public.customer_subject_deletion_queue enable row level security;

revoke all on public.customer_visitors from anon, authenticated, public;
revoke all on public.customer_sessions from anon, authenticated, public;
revoke all on public.customer_identity_ledger from anon, authenticated, public;
revoke all on public.customer_consent_ledger from anon, authenticated, public;
revoke all on public.customer_consent_current from anon, authenticated, public;
revoke all on public.customer_events from anon, authenticated, public;
revoke all on public.customer_event_daily_aggregates from anon, authenticated, public;
revoke all on public.customer_subject_deletion_queue from anon, authenticated, public;
revoke all on function public.refresh_customer_consent_current() from public, anon, authenticated;
revoke all on function public.prevent_customer_ledger_mutation() from public, anon, authenticated;
revoke all on function public.process_customer_subject_deletion(bigint, integer) from public, anon, authenticated;
grant all on public.customer_visitors, public.customer_sessions, public.customer_identity_ledger,
  public.customer_consent_ledger, public.customer_consent_current, public.customer_events,
  public.customer_event_daily_aggregates, public.customer_subject_deletion_queue to service_role;
grant execute on function public.process_customer_subject_deletion(bigint, integer) to service_role;
