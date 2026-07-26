begin;

-- Plan 01 advisor handoff and private attachment lifecycle contracts.
-- This migration defines service-owned records only. It does not add browser upload
-- endpoints, object storage policies, signed URLs, notification providers, or UI.

create table public.customer_advisor_handoffs (
  id uuid primary key default gen_random_uuid(),
  public_reference text collate "C" not null,
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  owner_scope text not null,
  owner_account_id uuid,
  guest_owner_scope_id uuid,
  amis_customer_link_id uuid references public.customer_amis_links(id) on delete restrict,
  reason_code text collate "C" not null,
  priority text not null default 'normal',
  status text not null default 'new',
  restricted_contact_reference text collate "C",
  assigned_advisor_id uuid references auth.users(id) on delete restrict,
  requested_contact_channel text collate "C",
  requested_contact_at timestamptz,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  first_response_due_at timestamptz not null,
  first_responded_at timestamptz,
  closed_at timestamptz,
  constraint customer_advisor_handoffs_public_reference_nonempty check (octet_length(public_reference) > 0),
  constraint customer_advisor_handoffs_owner_scope_check check (
    (owner_scope = 'auth' and owner_account_id is not null and guest_owner_scope_id is null)
    or (owner_scope = 'anon' and owner_account_id is null and guest_owner_scope_id is not null)
  ),
  constraint customer_advisor_handoffs_reason_code_nonempty check (octet_length(reason_code) > 0),
  constraint customer_advisor_handoffs_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint customer_advisor_handoffs_status_check check (status in ('new', 'assigned', 'contacted', 'waiting_customer', 'closed', 'cancelled')),
  constraint customer_advisor_handoffs_contact_reference_nonempty check (restricted_contact_reference is null or octet_length(restricted_contact_reference) > 0),
  constraint customer_advisor_handoffs_assigned_timestamp_check check ((assigned_advisor_id is null) = (assigned_at is null)),
  constraint customer_advisor_handoffs_closed_timestamp_check check ((status = 'closed') = (closed_at is not null)),
  constraint customer_advisor_handoffs_sla_after_created_check check (first_response_due_at > created_at)
);
create unique index customer_advisor_handoffs_public_reference_unique on public.customer_advisor_handoffs (public_reference collate "C");
create index customer_advisor_handoffs_conversation_idx on public.customer_advisor_handoffs (conversation_id, created_at);
create index customer_advisor_handoffs_owner_account_idx on public.customer_advisor_handoffs (owner_account_id) where owner_account_id is not null;
create index customer_advisor_handoffs_guest_scope_idx on public.customer_advisor_handoffs (guest_owner_scope_id) where guest_owner_scope_id is not null;

create table public.customer_advisor_handoff_summaries (
  id bigint generated always as identity primary key,
  handoff_id uuid not null references public.customer_advisor_handoffs(id) on delete cascade,
  summary_version text collate "C" not null,
  safe_summary text not null,
  structured_intent jsonb,
  product_ids uuid[] not null default '{}',
  variant_ids uuid[] not null default '{}',
  room_style_signals jsonb,
  stated_budget text,
  stated_timeline text,
  unresolved_questions jsonb,
  vision_scene_id uuid references public.room_scenes(id) on delete set null,
  last_message_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint customer_advisor_handoff_summaries_version_nonempty check (octet_length(summary_version) > 0),
  constraint customer_advisor_handoff_summaries_safe_summary_nonempty check (octet_length(safe_summary) > 0),
  constraint customer_advisor_handoff_summaries_structured_intent_object check (structured_intent is null or jsonb_typeof(structured_intent) = 'object'),
  constraint customer_advisor_handoff_summaries_room_style_object check (room_style_signals is null or jsonb_typeof(room_style_signals) = 'object'),
  constraint customer_advisor_handoff_summaries_questions_array check (unresolved_questions is null or jsonb_typeof(unresolved_questions) = 'array'),
  constraint customer_advisor_handoff_summaries_handoff_version_unique unique (handoff_id, summary_version)
);

create table public.customer_advisor_handoff_events (
  id bigint generated always as identity primary key,
  handoff_id uuid not null references public.customer_advisor_handoffs(id) on delete restrict,
  event_type text not null,
  from_status text not null,
  to_status text not null,
  actor_reference text collate "C" not null,
  safe_reason text,
  recorded_at timestamptz not null default now(),
  constraint customer_advisor_handoff_events_type_check check (event_type in ('assigned', 'status_changed', 'contacted', 'cancelled', 'closed')),
  constraint customer_advisor_handoff_events_from_status_check check (from_status in ('new', 'assigned', 'contacted', 'waiting_customer', 'closed', 'cancelled')),
  constraint customer_advisor_handoff_events_to_status_check check (to_status in ('new', 'assigned', 'contacted', 'waiting_customer', 'closed', 'cancelled')),
  constraint customer_advisor_handoff_events_actor_nonempty check (octet_length(actor_reference) > 0),
  constraint customer_advisor_handoff_events_reason_nonempty check (safe_reason is null or octet_length(safe_reason) > 0)
);
create index customer_advisor_handoff_events_handoff_idx on public.customer_advisor_handoff_events (handoff_id, recorded_at);

create table public.customer_advisor_notification_outbox (
  id bigint generated always as identity primary key,
  handoff_id uuid not null references public.customer_advisor_handoffs(id) on delete restrict,
  destination_adapter text collate "C" not null,
  delivery_status text not null default 'pending',
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  response_digest text collate "C",
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  constraint customer_advisor_notification_outbox_adapter_nonempty check (octet_length(destination_adapter) > 0),
  constraint customer_advisor_notification_outbox_status_check check (delivery_status in ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
  constraint customer_advisor_notification_outbox_attempt_count_check check (attempt_count >= 0 and attempt_count <= 20),
  constraint customer_advisor_notification_outbox_response_digest_shape check (response_digest is null or response_digest ~ '^[0-9a-f]{64}$'),
  constraint customer_advisor_notification_outbox_delivered_timestamp_check check ((delivery_status = 'delivered') = (delivered_at is not null))
);
create index customer_advisor_notification_outbox_retry_idx on public.customer_advisor_notification_outbox (delivery_status, next_retry_at);

create table public.chat_attachment_intents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  owner_scope text not null,
  owner_account_id uuid,
  guest_owner_scope_id uuid,
  expected_mime_type text collate "C" not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  state text not null default 'pending',
  constraint chat_attachment_intents_owner_scope_check check ((owner_scope = 'auth' and owner_account_id is not null and guest_owner_scope_id is null) or (owner_scope = 'anon' and owner_account_id is null and guest_owner_scope_id is not null)),
  constraint chat_attachment_intents_mime_check check (expected_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint chat_attachment_intents_state_check check (state in ('pending', 'confirmed', 'expired', 'cancelled')),
  constraint chat_attachment_intents_expiry_window_check check (expires_at > requested_at and expires_at <= requested_at + interval '24 hours'),
  constraint chat_attachment_intents_confirmed_timestamp_check check ((state = 'confirmed') = (confirmed_at is not null))
);
create index chat_attachment_intents_conversation_idx on public.chat_attachment_intents (conversation_id, requested_at);

create table public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.chat_attachment_intents(id) on delete restrict,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  owner_scope text not null,
  owner_account_id uuid,
  guest_owner_scope_id uuid,
  handoff_id uuid references public.customer_advisor_handoffs(id) on delete set null,
  object_path text collate "C" not null,
  normalized_object_path text collate "C",
  mime_type text collate "C" not null,
  byte_size bigint not null,
  sha256_digest text collate "C" not null,
  state text not null default 'pending',
  created_at timestamptz not null default now(),
  retention_expires_at timestamptz not null,
  deleted_at timestamptz,
  deletion_reason text collate "C",
  constraint chat_attachments_owner_scope_check check ((owner_scope = 'auth' and owner_account_id is not null and guest_owner_scope_id is null) or (owner_scope = 'anon' and owner_account_id is null and guest_owner_scope_id is not null)),
  constraint chat_attachments_private_object_path_check check (object_path !~* '^(https?://|/)' and object_path like 'room-photos/%'),
  constraint chat_attachments_private_normalized_path_check check (normalized_object_path is null or (normalized_object_path !~* '^(https?://|/)' and normalized_object_path like 'room-photos/%')),
  constraint chat_attachments_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint chat_attachments_byte_size_check check (byte_size > 0 and byte_size <= 10485760),
  constraint chat_attachments_digest_shape check (sha256_digest ~ '^[0-9a-f]{64}$'),
  constraint chat_attachments_state_check check (state in ('pending', 'active', 'failed', 'deleted')),
  constraint chat_attachments_retention_window_check check (retention_expires_at > created_at and retention_expires_at <= created_at + interval '90 days'),
  constraint chat_attachments_state_retention_check check (
    (state in ('pending', 'failed') and retention_expires_at <= created_at + interval '24 hours')
    or (state = 'active' and handoff_id is null and retention_expires_at <= created_at + interval '30 days')
    or (state = 'active' and handoff_id is not null and retention_expires_at <= created_at + interval '90 days')
    or state = 'deleted'
  ),
  constraint chat_attachments_deleted_metadata_check check ((state = 'deleted') = (deleted_at is not null)),
  constraint chat_attachments_deletion_reason_check check (deletion_reason is null or octet_length(deletion_reason) > 0)
);
create index chat_attachments_conversation_idx on public.chat_attachments (conversation_id, created_at);
create index chat_attachments_handoff_idx on public.chat_attachments (handoff_id) where handoff_id is not null;

create or replace function public.enforce_advisor_owner_contract()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $function$
declare
  conversation_owner_scope text;
  conversation_account_id uuid;
  conversation_guest_scope_id uuid;
  link_state text;
  link_account_id uuid;
begin
  select owner_scope, owner_account_id, guest_owner_scope_id
  into conversation_owner_scope, conversation_account_id, conversation_guest_scope_id
  from public.conversations where id = new.conversation_id;
  if new.owner_scope is distinct from conversation_owner_scope
     or new.owner_account_id is distinct from conversation_account_id
     or new.guest_owner_scope_id is distinct from conversation_guest_scope_id then
    raise exception 'advisor contract owner must match conversation owner' using errcode = 'P0001';
  end if;
  if tg_table_name = 'customer_advisor_handoffs'
     and nullif(to_jsonb(new) ->> 'amis_customer_link_id', '') is not null then
    select state, account_id into link_state, link_account_id
    from public.customer_amis_links
    where id = (to_jsonb(new) ->> 'amis_customer_link_id')::uuid;
    if link_state is null or link_state not in ('verified', 'active') or link_account_id is distinct from new.owner_account_id then
      raise exception 'advisor handoff AMIS link must be verified for the owner' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;
create trigger enforce_customer_advisor_handoff_owner before insert or update on public.customer_advisor_handoffs for each row execute function public.enforce_advisor_owner_contract();
create trigger enforce_chat_attachment_intent_owner before insert or update on public.chat_attachment_intents for each row execute function public.enforce_advisor_owner_contract();
create trigger enforce_chat_attachment_owner before insert or update on public.chat_attachments for each row execute function public.enforce_advisor_owner_contract();

create or replace function public.customer_advisor_handoff_prevent_mutation()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $function$
begin raise exception using errcode = 'P0001', message = 'advisor handoff events are append-only'; end;
$function$;
create trigger customer_advisor_handoff_events_append_only before update or delete on public.customer_advisor_handoff_events for each row execute function public.customer_advisor_handoff_prevent_mutation();

create or replace function public.enforce_customer_advisor_handoff_transition()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $function$
declare current_status text;
begin
  select status into current_status from public.customer_advisor_handoffs where id = new.handoff_id for update;
  if new.from_status is distinct from current_status or not (
    (new.from_status = 'new' and new.to_status in ('assigned', 'cancelled')) or
    (new.from_status = 'assigned' and new.to_status in ('contacted', 'waiting_customer', 'cancelled')) or
    (new.from_status = 'contacted' and new.to_status in ('waiting_customer', 'closed', 'cancelled')) or
    (new.from_status = 'waiting_customer' and new.to_status in ('contacted', 'closed', 'cancelled'))
  ) then raise exception 'advisor handoff transition is not allowed' using errcode = 'P0001'; end if;
  update public.customer_advisor_handoffs set status = new.to_status,
    closed_at = case when new.to_status = 'closed' then now() else closed_at end
  where id = new.handoff_id;
  return new;
end;
$function$;
create trigger enforce_customer_advisor_handoff_transition before insert on public.customer_advisor_handoff_events for each row execute function public.enforce_customer_advisor_handoff_transition();

create or replace function public.current_advisor_guest_scope_id()
returns uuid language sql stable security definer set search_path = pg_catalog as $function$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'guest_owner_scope_id', '')::uuid;
$function$;

alter table public.customer_advisor_handoffs enable row level security;
alter table public.customer_advisor_handoff_summaries enable row level security;
alter table public.customer_advisor_handoff_events enable row level security;
alter table public.customer_advisor_notification_outbox enable row level security;
alter table public.chat_attachment_intents enable row level security;
alter table public.chat_attachments enable row level security;

create view public.customer_advisor_handoff_safe_status with (security_barrier = true) as
select public_reference, status, priority, created_at, assigned_at, first_response_due_at, first_responded_at, closed_at
from public.customer_advisor_handoffs
where (owner_scope = 'auth' and owner_account_id = (select public.current_customer_account_id()))
   or (owner_scope = 'anon' and guest_owner_scope_id = (select public.current_advisor_guest_scope_id()));

revoke all on public.customer_advisor_handoffs, public.customer_advisor_handoff_summaries, public.customer_advisor_handoff_events, public.customer_advisor_notification_outbox, public.chat_attachment_intents, public.chat_attachments from public, anon, authenticated;
revoke all on function public.enforce_advisor_owner_contract(), public.customer_advisor_handoff_prevent_mutation(), public.enforce_customer_advisor_handoff_transition(), public.current_advisor_guest_scope_id() from public, anon, authenticated;
grant select on public.customer_advisor_handoff_safe_status to anon, authenticated;
grant all on public.customer_advisor_handoffs, public.customer_advisor_handoff_summaries, public.customer_advisor_handoff_events, public.customer_advisor_notification_outbox, public.chat_attachment_intents, public.chat_attachments to service_role;
grant usage, select on sequence public.customer_advisor_handoff_summaries_id_seq, public.customer_advisor_handoff_events_id_seq, public.customer_advisor_notification_outbox_id_seq to service_role;

comment on table public.customer_advisor_handoffs is 'Service-owned advisor handoffs. Browser clients can read only the safe-status view.';
comment on table public.customer_advisor_handoff_summaries is 'Staff/service-only versioned summaries; no raw transcript storage.';
comment on table public.customer_advisor_handoff_events is 'Append-only assignment and status history.';
comment on table public.customer_advisor_notification_outbox is 'Redacted notification delivery metadata; no raw notification payload or transcript.';
comment on table public.chat_attachments is 'Private attachment metadata only; object paths are never public URLs.';

commit;
