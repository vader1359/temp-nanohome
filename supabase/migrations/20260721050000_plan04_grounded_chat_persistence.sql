create table public.ai_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_key text not null,
  locale text not null,
  canonical_url text not null,
  visibility text not null default 'public',
  approval_state text not null default 'pending',
  content_hash text not null,
  source_updated_at timestamptz,
  ingestion_version text not null,
  is_active boolean not null default true,
  superseded_by uuid,
   created_at timestamptz not null default now(),
   unique (source_type, source_key, locale),
   unique (id, locale),
   unique (id, source_type, locale),
  check (visibility in ('public', 'internal')),
  check (approval_state in ('pending', 'approved', 'rejected')),
  check (content_hash ~ '^[0-9a-f]{64}$'),
  check (canonical_url ~ '^https://'),
  check (superseded_by is null or superseded_by <> id)
);

create index ai_sources_public_lookup_idx
  on public.ai_sources (locale, source_type)
  where visibility = 'public' and approval_state = 'approved' and is_active and superseded_by is null;

create function public.validate_ai_source_supersession()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.superseded_by is not null and not exists (
    select 1 from public.ai_sources s
    where s.id = new.superseded_by
      and s.source_type = new.source_type
      and s.locale = new.locale
  ) then
    raise exception 'superseded source must share source type and locale'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger ai_sources_supersession_scope_check
  before insert or update of superseded_by, source_type, locale on public.ai_sources
  for each row execute function public.validate_ai_source_supersession();

create table public.ai_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  locale text not null,
  heading_path text[] not null default '{}',
  position integer not null,
  text_content text not null,
  lexical_index tsvector generated always as (to_tsvector('simple', text_content)) stored,
  source_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (source_id, position),
  check (position >= 0),
  check (length(btrim(text_content)) between 1 and 12000),
  check (source_hash ~ '^[0-9a-f]{64}$')
  ,foreign key (source_id, locale) references public.ai_sources(id, locale) on delete cascade
);

create function public.validate_ai_chunk_locale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ai_sources s where s.id = new.source_id and s.locale = new.locale
  ) then
    raise exception 'chunk locale must match source locale' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger ai_chunks_locale_check
  before insert or update of source_id, locale on public.ai_chunks
  for each row execute function public.validate_ai_chunk_locale();

create index ai_chunks_lexical_idx on public.ai_chunks using gin (lexical_index);

alter table public.ai_sources
  add constraint ai_sources_superseded_scope_fk
  foreign key (superseded_by, source_type, locale)
  references public.ai_sources(id, source_type, locale);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  owner_scope text not null,
  locale text not null,
  consent_version text not null,
  consent_expires_at timestamptz not null,
  conversation_storage_enabled boolean not null default false,
  retention_expires_at timestamptz not null,
  state text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_scope in ('anon', 'auth')),
  check ((owner_scope = 'auth' and owner_id is not null) or (owner_scope = 'anon' and owner_id is null)),
  check (consent_expires_at <= retention_expires_at),
  check (retention_expires_at >= created_at),
  check (state in ('active', 'expired', 'deleted'))
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null,
  content text not null,
  tool_trace_ref text,
  model_version text,
  prompt_version text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (role in ('user', 'assistant', 'system')),
  check (length(btrim(content)) between 1 and 20000),
  check (content !~ '<script[^>]*>')
);

create index chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at);

create table public.chat_answer_evidence (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  source_id uuid references public.ai_sources(id) on delete set null,
  tool_result_digest text,
  model_version text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  check (tool_result_digest is null or tool_result_digest ~ '^[0-9a-f]{64}$')
);

create index chat_answer_evidence_message_idx on public.chat_answer_evidence (message_id);

alter table public.ai_sources enable row level security;
alter table public.ai_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_answer_evidence enable row level security;

revoke all on public.ai_sources, public.ai_chunks, public.conversations,
  public.chat_messages, public.chat_answer_evidence from public, anon, authenticated;
grant select on public.ai_sources, public.ai_chunks to anon, authenticated;
grant select, insert, update, delete on public.conversations, public.chat_messages,
  public.chat_answer_evidence to authenticated;

create policy ai_sources_public_read on public.ai_sources
  for select to anon, authenticated
  using (visibility = 'public' and approval_state = 'approved' and is_active and superseded_by is null);

create policy ai_chunks_public_read on public.ai_chunks
  for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.ai_sources s
    where s.id = source_id and s.visibility = 'public' and s.approval_state = 'approved'
      and s.is_active and s.superseded_by is null
  ));

create policy conversations_owner_read on public.conversations
  for select to authenticated using (
    owner_id = (select auth.uid()) and state = 'active'
    and conversation_storage_enabled and retention_expires_at > now()
  );
create policy conversations_owner_insert on public.conversations
  for insert to authenticated with check (
    owner_scope = 'auth' and owner_id = (select auth.uid())
    and conversation_storage_enabled and state = 'active'
    and consent_expires_at > now() and retention_expires_at > now()
  );
create policy conversations_owner_update on public.conversations
  for update to authenticated using (
    owner_id = (select auth.uid()) and state = 'active'
    and conversation_storage_enabled and retention_expires_at > now()
  )
  with check (
    owner_id = (select auth.uid()) and owner_scope = 'auth'
    and conversation_storage_enabled and state = 'active'
    and consent_expires_at > now() and retention_expires_at > now()
  );
create policy conversations_owner_delete on public.conversations
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy chat_messages_owner_read on public.chat_messages
  for select to authenticated using (exists (
    select 1 from public.conversations c where c.id = conversation_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled and c.retention_expires_at > now()
  ));
create policy chat_messages_owner_insert on public.chat_messages
  for insert to authenticated with check (role = 'user' and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled
      and c.consent_expires_at > now() and c.retention_expires_at > now()
      and expires_at > now() and expires_at <= c.retention_expires_at
  ));
create policy chat_messages_owner_update on public.chat_messages
  for update to authenticated using (exists (
    select 1 from public.conversations c where c.id = conversation_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled
      and c.consent_expires_at > now() and c.retention_expires_at > now()
      and chat_messages.expires_at > now()
  )) with check (exists (
    select 1 from public.conversations c where c.id = conversation_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled
      and c.consent_expires_at > now() and c.retention_expires_at > now()
      and expires_at > now() and expires_at <= c.retention_expires_at
  ));
create policy chat_messages_owner_delete on public.chat_messages
  for delete to authenticated using (exists (
    select 1 from public.conversations c where c.id = conversation_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled
      and c.consent_expires_at > now() and c.retention_expires_at > now()
  ));

create policy chat_answer_evidence_owner_read on public.chat_answer_evidence
  for select to authenticated using (exists (
    select 1 from public.chat_messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled and c.retention_expires_at > now()
      and m.expires_at > now()
      and (source_id is null or exists (
        select 1 from public.ai_sources s
        where s.id = chat_answer_evidence.source_id
          and s.visibility = 'public' and s.approval_state = 'approved'
          and s.is_active and s.superseded_by is null
      ))
  ));
create policy chat_answer_evidence_owner_insert on public.chat_answer_evidence
  for insert to authenticated with check (exists (
    select 1 from public.chat_messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled
      and c.consent_expires_at > now() and c.retention_expires_at > now()
      and m.expires_at > now() and m.expires_at <= c.retention_expires_at
      and (source_id is null or exists (
        select 1 from public.ai_sources s
        where s.id = source_id and s.visibility = 'public'
          and s.approval_state = 'approved' and s.is_active and s.superseded_by is null
      ))
  ));
create policy chat_answer_evidence_owner_update on public.chat_answer_evidence
  for update to authenticated using (exists (
    select 1 from public.chat_messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled
      and c.consent_expires_at > now() and c.retention_expires_at > now()
      and m.expires_at > now()
  )) with check (exists (
    select 1 from public.chat_messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled
      and c.consent_expires_at > now() and c.retention_expires_at > now()
      and m.expires_at > now() and m.expires_at <= c.retention_expires_at
      and (source_id is null or exists (
        select 1 from public.ai_sources s
        where s.id = source_id and s.visibility = 'public'
          and s.approval_state = 'approved' and s.is_active and s.superseded_by is null
      ))
  ));
create policy chat_answer_evidence_owner_delete on public.chat_answer_evidence
  for delete to authenticated using (exists (
    select 1 from public.chat_messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.owner_id = (select auth.uid())
      and c.state = 'active' and c.conversation_storage_enabled
      and c.consent_expires_at > now() and c.retention_expires_at > now()
  ));

comment on table public.ai_sources is 'Approved, hashed source metadata for grounded chat; no raw model payloads.';
comment on table public.ai_chunks is 'Bounded source text chunks; embeddings and image/vector payloads are intentionally absent.';
comment on table public.conversations is 'Consent and retention metadata; conversation storage is disabled by default.';
comment on policy conversations_owner_read on public.conversations is 'Owners can read only active, storage-enabled, retention-unexpired conversations; consent expiry does not hide retained history.';
comment on table public.chat_messages is 'Bounded consented conversation messages; trusted ingestion and retention jobs use privileged server paths.';
comment on table public.chat_answer_evidence is 'Source evidence references and digests only; trusted ingestion and retention jobs use privileged server paths.';
