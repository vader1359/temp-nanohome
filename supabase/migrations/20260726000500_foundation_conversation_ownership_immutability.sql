begin;

create or replace function public.prevent_conversation_ownership_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if old.owner_scope = 'auth'
    and (
      new.owner_scope is distinct from old.owner_scope
      or new.owner_id is distinct from old.owner_id
      or new.owner_account_id is distinct from old.owner_account_id
      or new.guest_owner_scope_id is distinct from old.guest_owner_scope_id
      or new.guest_owner_token_digest is distinct from old.guest_owner_token_digest
      or new.guest_owner_scope_expires_at is distinct from old.guest_owner_scope_expires_at
    ) then
    raise exception 'authenticated conversation ownership cannot be changed'
      using errcode = 'P0001';
  end if;

  if old.owner_scope = 'anon'
    and old.guest_owner_scope_id is not null
    and (
      new.owner_scope is distinct from old.owner_scope
      or new.owner_id is distinct from old.owner_id
      or new.owner_account_id is distinct from old.owner_account_id
      or new.guest_owner_scope_id is distinct from old.guest_owner_scope_id
      or new.guest_owner_token_digest is distinct from old.guest_owner_token_digest
      or new.guest_owner_scope_expires_at is distinct from old.guest_owner_scope_expires_at
    ) then
    raise exception 'guest conversation ownership cannot be changed'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists a_prevent_conversation_ownership_mutation on public.conversations;
create trigger a_prevent_conversation_ownership_mutation
  before update of owner_scope, owner_id, owner_account_id,
    guest_owner_scope_id, guest_owner_token_digest, guest_owner_scope_expires_at
  on public.conversations
  for each row execute function public.prevent_conversation_ownership_mutation();

revoke all on function public.prevent_conversation_ownership_mutation() from public, anon, authenticated;

create or replace function public.delete_verified_guest_conversation(
  p_conversation_id uuid,
  p_guest_token text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if public.verify_conversation_guest_scope(p_conversation_id, p_guest_token) is null then
    return false;
  end if;

  update public.conversations
  set state = 'deleted'
  where id = p_conversation_id
    and state = 'active';

  return found;
end;
$function$;

comment on function public.prevent_conversation_ownership_mutation() is 'Prevents assigned authenticated and guest conversation ownership identities from being replaced, detached, or converted.';

commit;
