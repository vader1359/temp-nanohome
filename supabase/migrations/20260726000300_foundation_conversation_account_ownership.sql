begin;

alter table public.conversations
  add column owner_account_id uuid references public.customer_accounts(id) on delete restrict,
  add column guest_owner_scope_id uuid,
  add column guest_owner_token_digest text,
  add column guest_owner_scope_expires_at timestamptz;

update public.conversations conversation
set owner_account_id = account.id
from public.customer_accounts account
where conversation.owner_scope = 'auth'
  and account.legacy_supabase_user_id = conversation.owner_id;

do $block$
begin
  if exists (
    select 1
    from public.conversations
    where owner_scope = 'auth' and owner_account_id is null
  ) then
    raise exception 'conversation ownership backfill left authenticated rows without accounts';
  end if;
end;
$block$;

alter table public.conversations
  add constraint conversations_authenticated_account_required_check check (
    owner_scope <> 'auth'
    or (owner_account_id is not null and guest_owner_scope_id is null
      and guest_owner_token_digest is null and guest_owner_scope_expires_at is null)
  ),
  add constraint conversations_guest_scope_shape_check check (
    owner_scope <> 'anon'
    or (
      (guest_owner_scope_id is null and guest_owner_token_digest is null and guest_owner_scope_expires_at is null)
      or (
        guest_owner_scope_id is not null
        and guest_owner_token_digest ~ '^[0-9a-f]{64}$'
        and guest_owner_scope_expires_at is not null
        and guest_owner_scope_expires_at >= created_at
      )
    )
  ),
  add constraint conversations_guest_owner_forbidden_account_check check (
    owner_scope <> 'anon' or (owner_account_id is null and owner_id is null)
  );

create index conversations_owner_account_created_idx
  on public.conversations(owner_account_id, created_at desc)
  where owner_account_id is not null;

create unique index conversations_guest_owner_scope_id_unique
  on public.conversations(guest_owner_scope_id)
  where guest_owner_scope_id is not null;

create or replace function public.assign_conversation_account_ownership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  legacy_account_id uuid;
begin
  if tg_op = 'UPDATE' and new.owner_account_id is distinct from old.owner_account_id then
    raise exception 'conversation account ownership cannot be reassigned'
      using errcode = 'P0001';
  end if;

  if new.owner_scope = 'auth' then
    if new.owner_id is not null then
      legacy_account_id := public.legacy_customer_account_id(new.owner_id);
      if legacy_account_id is null then
        raise exception 'legacy conversation owner must map to an internal account'
          using errcode = 'P0001';
      end if;

      if new.owner_account_id is null then
        new.owner_account_id := legacy_account_id;
      elsif new.owner_account_id <> legacy_account_id then
        raise exception 'legacy conversation owner and account ownership must match'
          using errcode = 'P0001';
      end if;
    elsif new.owner_account_id is null then
      raise exception 'authenticated conversation requires an internal account'
        using errcode = 'P0001';
    end if;
  elsif new.guest_owner_scope_id is null
    or new.guest_owner_token_digest is null
    or new.guest_owner_scope_expires_at is null then
    raise exception 'new guest conversation requires a server-generated opaque scope and digest'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

create trigger assign_conversation_account_ownership
  before insert or update of owner_id, owner_account_id, owner_scope,
    guest_owner_scope_id, guest_owner_token_digest, guest_owner_scope_expires_at
  on public.conversations
  for each row execute function public.assign_conversation_account_ownership();

alter table public.chat_messages
  add column message_ref text,
  add column content_blocks jsonb not null default '[]'::jsonb,
  add constraint chat_messages_message_ref_check check (
    message_ref is null or length(btrim(message_ref)) between 1 and 256
  ),
  add constraint chat_messages_content_blocks_array_check check (
    jsonb_typeof(content_blocks) = 'array'
  );

create unique index chat_messages_conversation_message_ref_unique
  on public.chat_messages(conversation_id, message_ref)
  where message_ref is not null;

comment on column public.conversations.owner_account_id is 'Internal authenticated owner; legacy owner_id remains overlap metadata only.';
comment on column public.conversations.guest_owner_token_digest is 'SHA-256 digest of a random server-generated opaque guest token; raw tokens are never stored.';
comment on column public.chat_messages.message_ref is 'Server idempotency reference scoped to one conversation.';
comment on column public.chat_messages.content_blocks is 'Structured message blocks persisted as a JSON array; browser roles cannot query transcript rows.';

commit;
