begin;

create or replace function public.verify_conversation_guest_scope(
  p_conversation_id uuid,
  p_guest_token text
)
returns uuid
language sql
security definer
set search_path = pg_catalog, public, extensions
stable
as $function$
  select conversation.guest_owner_scope_id
  from public.conversations conversation
  where conversation.id = p_conversation_id
    and p_guest_token is not null
    and conversation.owner_scope = 'anon'
    and conversation.state = 'active'
    and conversation.conversation_storage_enabled
    and conversation.retention_expires_at > now()
    and conversation.guest_owner_scope_expires_at > now()
    and conversation.guest_owner_token_digest = encode(extensions.digest(p_guest_token, 'sha256'), 'hex')
$function$;

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
  set state = 'deleted',
      guest_owner_scope_expires_at = now()
  where id = p_conversation_id
    and state = 'active';

  return found;
end;
$function$;

drop policy if exists conversations_owner_read on public.conversations;
drop policy if exists conversations_owner_insert on public.conversations;
drop policy if exists conversations_owner_update on public.conversations;
drop policy if exists conversations_owner_delete on public.conversations;
drop policy if exists chat_messages_owner_read on public.chat_messages;
drop policy if exists chat_messages_owner_insert on public.chat_messages;
drop policy if exists chat_messages_owner_update on public.chat_messages;
drop policy if exists chat_messages_owner_delete on public.chat_messages;
drop policy if exists chat_answer_evidence_owner_read on public.chat_answer_evidence;
drop policy if exists chat_answer_evidence_owner_insert on public.chat_answer_evidence;
drop policy if exists chat_answer_evidence_owner_update on public.chat_answer_evidence;
drop policy if exists chat_answer_evidence_owner_delete on public.chat_answer_evidence;

revoke all on public.conversations, public.chat_messages, public.chat_answer_evidence
  from public, anon, authenticated;
revoke execute on function public.assign_conversation_account_ownership() from public, anon, authenticated;
revoke execute on function public.verify_conversation_guest_scope(uuid, text) from public, anon, authenticated;
revoke execute on function public.delete_verified_guest_conversation(uuid, text) from public, anon, authenticated;

comment on function public.verify_conversation_guest_scope(uuid, text) is 'Server-only guest scope resolver. It accepts only an exact opaque token digest for an active, retained conversation.';
comment on function public.delete_verified_guest_conversation(uuid, text) is 'Server-only guest deletion path; raw tokens never leave the verifier and browser roles have no EXECUTE grant.';
comment on table public.conversations is 'Consent and retention metadata with internal account ownership or server-verified opaque guest scope; browser roles cannot retrieve transcripts.';

commit;
