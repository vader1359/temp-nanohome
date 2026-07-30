begin;

alter table public.customer_amis_links
  alter column user_id drop not null;

create table public.customer_account_precreation_batches (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('local', 'staging', 'production')),
  version text not null check (length(version) between 1 and 128),
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  source_watermark text not null check (length(source_watermark) between 1 and 256),
  status text not null check (status in ('dry_run', 'approved', 'running', 'completed', 'reconciled', 'rolled_back', 'failed')),
  expected_count integer not null check (expected_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  conflict_count integer not null default 0 check (conflict_count >= 0),
  approved_by text,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((approved_by is null) = (approved_at is null)),
  check ((status in ('approved', 'running', 'completed', 'reconciled', 'rolled_back', 'failed')) = (approved_by is not null))
);

create unique index customer_account_precreation_batches_manifest_idx
  on public.customer_account_precreation_batches(environment, manifest_digest);

create table public.customer_account_precreation_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.customer_account_precreation_batches(id) on delete restrict,
  ordinal integer not null check (ordinal > 0),
  amis_customer_id text not null check (length(amis_customer_id) between 1 and 256),
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  phone_lookup_digest text check (phone_lookup_digest is null or phone_lookup_digest ~ '^[0-9a-f]{64}$'),
  email_lookup_digest text check (email_lookup_digest is null or email_lookup_digest ~ '^[0-9a-f]{64}$'),
  source_modified_at timestamptz not null,
  planned_account_id uuid not null,
  account_id uuid references public.customer_accounts(id) on delete restrict,
  result_code text not null check (result_code in ('planned', 'created', 'skipped', 'conflict', 'failed', 'claimed', 'rolled_back')),
  result_reason text,
  before_marker text,
  after_marker text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, ordinal),
  unique (batch_id, amis_customer_id),
  unique (batch_id, planned_account_id),
  check (phone_lookup_digest is not null or email_lookup_digest is not null)
);

create index customer_account_precreation_items_batch_result_idx
  on public.customer_account_precreation_items(batch_id, result_code, ordinal);

create table public.customer_account_claim_candidates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.customer_accounts(id) on delete restrict,
  amis_customer_link_id uuid not null unique references public.customer_amis_links(id) on delete restrict,
  phone_lookup_digest text check (phone_lookup_digest is null or phone_lookup_digest ~ '^[0-9a-f]{64}$'),
  email_lookup_digest text check (email_lookup_digest is null or email_lookup_digest ~ '^[0-9a-f]{64}$'),
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  source_modified_at timestamptz not null,
  status text not null check (status in ('precreated_unclaimed', 'claim_in_progress', 'claimed', 'conflict', 'suspended', 'rolled_back')),
  claimed_firebase_uid text check (claimed_firebase_uid is null or length(claimed_firebase_uid) between 1 and 256),
  claimed_at timestamptz,
  batch_id uuid not null references public.customer_account_precreation_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'claimed') = (claimed_firebase_uid is not null and claimed_at is not null)),
  check (status <> 'claimed' or claimed_firebase_uid is not null),
  check (phone_lookup_digest is not null or email_lookup_digest is not null)
);

create unique index customer_account_claim_candidates_phone_active_idx
  on public.customer_account_claim_candidates(phone_lookup_digest)
  where phone_lookup_digest is not null
    and status in ('precreated_unclaimed', 'claim_in_progress', 'claimed');

create unique index customer_account_claim_candidates_email_active_idx
  on public.customer_account_claim_candidates(email_lookup_digest)
  where email_lookup_digest is not null
    and status in ('precreated_unclaimed', 'claim_in_progress', 'claimed');

create index customer_account_claim_candidates_customer_status_idx
  on public.customer_account_claim_candidates(batch_id, status, created_at);

create table public.customer_account_verified_identities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  kind text not null check (kind in ('phone', 'email')),
  lookup_digest text not null check (lookup_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  verified_at timestamptz not null default now(),
  source text not null check (source in ('firebase_verified_claim', 'owner_migration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customer_account_verified_identities_active_digest_idx
  on public.customer_account_verified_identities(kind, lookup_digest)
  where status = 'active';

create unique index customer_account_verified_identities_active_account_kind_idx
  on public.customer_account_verified_identities(account_id, kind)
  where status = 'active';

create table public.customer_account_precreation_audit (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.customer_account_precreation_batches(id) on delete restrict,
  item_id uuid references public.customer_account_precreation_items(id) on delete restrict,
  event_type text not null check (event_type in ('batch_approved', 'item_created', 'item_skipped', 'item_conflict', 'claim_succeeded', 'claim_replayed', 'claim_conflict', 'rollback', 'reconcile')),
  result_code text not null,
  event_digest text not null check (event_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index customer_account_precreation_audit_batch_created_idx
  on public.customer_account_precreation_audit(batch_id, created_at, id);

create trigger touch_customer_account_precreation_batches_updated_at
  before update on public.customer_account_precreation_batches
  for each row execute function public.touch_updated_at();

create trigger touch_customer_account_precreation_items_updated_at
  before update on public.customer_account_precreation_items
  for each row execute function public.touch_updated_at();

create trigger touch_customer_account_claim_candidates_updated_at
  before update on public.customer_account_claim_candidates
  for each row execute function public.touch_updated_at();

create trigger touch_customer_account_verified_identities_updated_at
  before update on public.customer_account_verified_identities
  for each row execute function public.touch_updated_at();

alter table public.customer_account_precreation_batches enable row level security;
alter table public.customer_account_precreation_items enable row level security;
alter table public.customer_account_claim_candidates enable row level security;
alter table public.customer_account_verified_identities enable row level security;
alter table public.customer_account_precreation_audit enable row level security;

create policy customer_account_precreation_batches_deny_browser
  on public.customer_account_precreation_batches for all to anon, authenticated
  using (false) with check (false);

create policy customer_account_precreation_items_deny_browser
  on public.customer_account_precreation_items for all to anon, authenticated
  using (false) with check (false);

create policy customer_account_claim_candidates_deny_browser
  on public.customer_account_claim_candidates for all to anon, authenticated
  using (false) with check (false);

create policy customer_account_verified_identities_deny_browser
  on public.customer_account_verified_identities for all to anon, authenticated
  using (false) with check (false);

create policy customer_account_precreation_audit_deny_browser
  on public.customer_account_precreation_audit for all to anon, authenticated
  using (false) with check (false);

revoke all on public.customer_account_precreation_batches,
  public.customer_account_precreation_items,
  public.customer_account_claim_candidates,
  public.customer_account_verified_identities,
  public.customer_account_precreation_audit
from public, anon, authenticated;
grant all on public.customer_account_precreation_batches,
  public.customer_account_precreation_items,
  public.customer_account_claim_candidates,
  public.customer_account_verified_identities,
  public.customer_account_precreation_audit to service_role;

create or replace function public.begin_customer_account_precreation_batch(
  p_environment text,
  p_version text,
  p_manifest_digest text,
  p_source_watermark text,
  p_expected_count integer,
  p_approved_by text,
  p_approved_at timestamptz default now()
)
returns table(batch_id uuid, batch_status text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_batch public.customer_account_precreation_batches%rowtype;
begin
  if p_environment not in ('local', 'staging', 'production')
    or p_version is null or length(p_version) = 0
    or p_manifest_digest is null or p_manifest_digest !~ '^[0-9a-f]{64}$'
    or p_source_watermark is null or length(p_source_watermark) = 0
    or p_expected_count is null or p_expected_count < 0
    or p_approved_by is null or length(btrim(p_approved_by)) = 0
    or p_approved_at is null then
    raise exception 'invalid precreation batch approval marker';
  end if;

  select * into v_batch
  from public.customer_account_precreation_batches
  where environment = p_environment and manifest_digest = p_manifest_digest
  for update;

  if v_batch.id is not null then
    if v_batch.version <> p_version
      or v_batch.source_watermark <> p_source_watermark
      or v_batch.expected_count <> p_expected_count then
      raise exception 'precreation manifest marker mismatch';
    end if;
    return query select v_batch.id, v_batch.status;
    return;
  end if;

  insert into public.customer_account_precreation_batches(
    environment, version, manifest_digest, source_watermark, status,
    expected_count, approved_by, approved_at
  ) values (
    p_environment, p_version, p_manifest_digest, p_source_watermark, 'approved',
    p_expected_count, btrim(p_approved_by), p_approved_at
  )
  on conflict (environment, manifest_digest) do nothing
  returning * into v_batch;

  if not found then
    select * into v_batch
    from public.customer_account_precreation_batches
    where environment = p_environment and manifest_digest = p_manifest_digest
    for update;
    if v_batch.id is null then raise exception 'precreation batch insert raced without a row'; end if;
    if v_batch.version <> p_version
      or v_batch.source_watermark <> p_source_watermark
      or v_batch.expected_count <> p_expected_count then
      raise exception 'precreation manifest marker mismatch';
    end if;
    return query select v_batch.id, v_batch.status;
    return;
  end if;

  insert into public.customer_account_precreation_audit(
    batch_id, event_type, result_code, event_digest
  ) values (
    v_batch.id, 'batch_approved', 'approved', p_manifest_digest
  );

  return query select v_batch.id, v_batch.status;
end;
$function$;

create or replace function public.precreate_customer_account_item(
  p_batch_id uuid,
  p_manifest_digest text,
  p_ordinal integer,
  p_amis_customer_id text,
  p_source_digest text,
  p_phone_lookup_digest text,
  p_email_lookup_digest text,
  p_source_modified_at timestamptz,
  p_planned_account_id uuid
)
returns table(result_code text, account_id uuid, claim_candidate_id uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_batch public.customer_account_precreation_batches%rowtype;
  v_item public.customer_account_precreation_items%rowtype;
  v_candidate public.customer_account_claim_candidates%rowtype;
  v_link public.customer_amis_links%rowtype;
  v_item_id uuid;
  v_link_id uuid;
begin
  if p_manifest_digest is null or p_manifest_digest !~ '^[0-9a-f]{64}$'
    or p_source_digest is null or p_source_digest !~ '^[0-9a-f]{64}$'
    or (p_phone_lookup_digest is not null and p_phone_lookup_digest !~ '^[0-9a-f]{64}$')
    or (p_email_lookup_digest is not null and p_email_lookup_digest !~ '^[0-9a-f]{64}$')
    or (p_phone_lookup_digest is null and p_email_lookup_digest is null)
    or p_ordinal is null or p_ordinal < 1
    or p_amis_customer_id is null or length(p_amis_customer_id) = 0
    or p_source_modified_at is null or p_planned_account_id is null then
    raise exception 'invalid precreation item';
  end if;

  select * into v_batch
  from public.customer_account_precreation_batches
  where id = p_batch_id
  for update;
  if v_batch.id is null then raise exception 'precreation batch not found'; end if;
  if v_batch.manifest_digest <> p_manifest_digest then raise exception 'precreation manifest digest mismatch'; end if;
  if v_batch.status not in ('approved', 'running') then raise exception 'precreation batch is not executable'; end if;
  if v_batch.status = 'approved' then
    update public.customer_account_precreation_batches
    set status = 'running', started_at = coalesce(started_at, now())
    where id = p_batch_id;
  end if;

  select * into v_item
  from public.customer_account_precreation_items
  where batch_id = p_batch_id
    and (
      ordinal = p_ordinal
      or amis_customer_id = p_amis_customer_id
      or planned_account_id = p_planned_account_id
    )
  order by case when ordinal = p_ordinal then 0 else 1 end, id
  for update;
  if v_item.id is not null then
    if v_item.amis_customer_id <> p_amis_customer_id
      or v_item.source_digest <> p_source_digest
      or v_item.phone_lookup_digest is distinct from p_phone_lookup_digest
      or v_item.email_lookup_digest is distinct from p_email_lookup_digest
      or v_item.source_modified_at <> p_source_modified_at
      or v_item.planned_account_id <> p_planned_account_id then
      raise exception 'precreation item marker mismatch';
    end if;
    return query select v_item.result_code, v_item.account_id, (
      select candidate.id from public.customer_account_claim_candidates candidate
      where candidate.account_id = v_item.account_id
    );
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array(
      p_amis_customer_id,
      coalesce(p_phone_lookup_digest, ''),
      coalesce(p_email_lookup_digest, '')
    )::text,
    0
  ));

  select * into v_candidate
  from public.customer_account_claim_candidates candidate
  where (p_phone_lookup_digest is not null and candidate.phone_lookup_digest = p_phone_lookup_digest)
    or (p_email_lookup_digest is not null and candidate.email_lookup_digest = p_email_lookup_digest)
    or candidate.source_digest = p_source_digest
  order by candidate.created_at
  limit 1
  for update;
  if v_candidate.id is not null then
    if v_candidate.source_digest = p_source_digest
      and v_candidate.batch_id = p_batch_id
      and v_candidate.account_id = p_planned_account_id
      and v_candidate.status in ('precreated_unclaimed', 'claim_in_progress') then
      insert into public.customer_account_precreation_items(
        batch_id, ordinal, amis_customer_id, source_digest,
        phone_lookup_digest, email_lookup_digest, source_modified_at,
        planned_account_id, account_id, result_code, result_reason, after_marker
      ) values (
        p_batch_id, p_ordinal, p_amis_customer_id, p_source_digest,
        p_phone_lookup_digest, p_email_lookup_digest, p_source_modified_at,
        p_planned_account_id, v_candidate.account_id, 'skipped', 'exact_retry', 'idempotent'
      ) returning id into v_item_id;
      insert into public.customer_account_precreation_audit(batch_id, item_id, event_type, result_code, event_digest)
      values (p_batch_id, v_item_id, 'item_skipped', 'exact_retry', p_source_digest);
      return query select 'skipped'::text, v_candidate.account_id, v_candidate.id;
      return;
    end if;
    insert into public.customer_account_precreation_items(
      batch_id, ordinal, amis_customer_id, source_digest,
      phone_lookup_digest, email_lookup_digest, source_modified_at,
      planned_account_id, result_code, result_reason, after_marker
    ) values (
      p_batch_id, p_ordinal, p_amis_customer_id, p_source_digest,
      p_phone_lookup_digest, p_email_lookup_digest, p_source_modified_at,
      p_planned_account_id, 'conflict', 'identity_or_source_collision', 'quarantined'
    ) returning id into v_item_id;
    insert into public.customer_account_precreation_audit(batch_id, item_id, event_type, result_code, event_digest)
    values (p_batch_id, v_item_id, 'item_conflict', 'identity_or_source_collision', p_source_digest);
    return query select 'conflict'::text, null::uuid, null::uuid;
    return;
  end if;

  select * into v_link
  from public.customer_amis_links link
  where link.amis_customer_id = p_amis_customer_id
    and link.state in ('verified', 'active')
  order by case when link.state = 'active' then 0 else 1 end, link.created_at
  limit 1
  for update;
  if v_link.id is not null then
    insert into public.customer_account_precreation_items(
      batch_id, ordinal, amis_customer_id, source_digest,
      phone_lookup_digest, email_lookup_digest, source_modified_at,
      planned_account_id, account_id, result_code, result_reason, after_marker
    ) values (
      p_batch_id, p_ordinal, p_amis_customer_id, p_source_digest,
      p_phone_lookup_digest, p_email_lookup_digest, p_source_modified_at,
      p_planned_account_id, v_link.account_id, 'conflict', 'existing_amis_link', 'quarantined'
    ) returning id into v_item_id;
    insert into public.customer_account_precreation_audit(batch_id, item_id, event_type, result_code, event_digest)
    values (p_batch_id, v_item_id, 'item_conflict', 'existing_amis_link', p_source_digest);
    return query select 'conflict'::text, v_link.account_id, null::uuid;
    return;
  end if;

  if exists (select 1 from public.customer_accounts where id = p_planned_account_id) then
    insert into public.customer_account_precreation_items(
      batch_id, ordinal, amis_customer_id, source_digest,
      phone_lookup_digest, email_lookup_digest, source_modified_at,
      planned_account_id, account_id, result_code, result_reason, after_marker
    ) values (
      p_batch_id, p_ordinal, p_amis_customer_id, p_source_digest,
      p_phone_lookup_digest, p_email_lookup_digest, p_source_modified_at,
      p_planned_account_id, p_planned_account_id, 'conflict', 'planned_account_id_occupied', 'quarantined'
    ) returning id into v_item_id;
    insert into public.customer_account_precreation_audit(batch_id, item_id, event_type, result_code, event_digest)
    values (p_batch_id, v_item_id, 'item_conflict', 'planned_account_id_occupied', p_source_digest);
    return query select 'conflict'::text, p_planned_account_id, null::uuid;
    return;
  end if;

  insert into public.customer_accounts(id) values (p_planned_account_id);
  insert into public.customer_amis_links(
    account_id, user_id, amis_customer_id, state, method, evidence_category, review_reason
  ) values (
    p_planned_account_id, null, p_amis_customer_id, 'verified', 'trusted_migration',
    'account_precreation', 'batch:' || p_batch_id::text
  ) returning id into v_link_id;
  insert into public.customer_account_claim_candidates(
    account_id, amis_customer_link_id, phone_lookup_digest, email_lookup_digest,
    source_digest, source_modified_at, status, batch_id
  ) values (
    p_planned_account_id, v_link_id, p_phone_lookup_digest, p_email_lookup_digest,
    p_source_digest, p_source_modified_at, 'precreated_unclaimed', p_batch_id
  ) returning * into v_candidate;
  insert into public.customer_account_precreation_items(
    batch_id, ordinal, amis_customer_id, source_digest,
    phone_lookup_digest, email_lookup_digest, source_modified_at,
    planned_account_id, account_id, result_code, result_reason, before_marker, after_marker
  ) values (
    p_batch_id, p_ordinal, p_amis_customer_id, p_source_digest,
    p_phone_lookup_digest, p_email_lookup_digest, p_source_modified_at,
    p_planned_account_id, p_planned_account_id, 'created', 'precreated_unclaimed', 'absent', 'account_link_candidate'
  ) returning id into v_item_id;
  insert into public.customer_account_precreation_audit(batch_id, item_id, event_type, result_code, event_digest)
  values (p_batch_id, v_item_id, 'item_created', 'precreated_unclaimed', p_source_digest);
  return query select 'created'::text, p_planned_account_id, v_candidate.id;
end;
$function$;

create or replace function public.claim_customer_account_precreation(
  p_firebase_uid text,
  p_phone_lookup_digest text,
  p_email_lookup_digest text,
  p_phone_verified boolean,
  p_email_verified boolean,
  p_policy_acceptances jsonb default '[]'::jsonb
)
returns table(
  claim_status text,
  account_id uuid,
  phone_verified boolean,
  email_verified boolean,
  checkout_ready boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_candidate public.customer_account_claim_candidates%rowtype;
  v_match public.customer_account_claim_candidates%rowtype;
  v_principal public.customer_firebase_principals%rowtype;
  v_account_principal public.customer_firebase_principals%rowtype;
  v_identity public.customer_account_verified_identities%rowtype;
  v_item_id uuid;
  v_policy jsonb;
  v_policy_kind text;
  v_policy_version text;
  v_phone_digest text;
  v_email_digest text;
  v_has_phone boolean;
  v_has_email boolean;
  v_replay boolean := false;
begin
  v_phone_digest := case when p_phone_verified is true then p_phone_lookup_digest else null end;
  v_email_digest := case when p_email_verified is true then p_email_lookup_digest else null end;

  if p_firebase_uid is null or length(btrim(p_firebase_uid)) not between 1 and 256
    or (p_phone_verified is true and (p_phone_lookup_digest is null or p_phone_lookup_digest !~ '^[0-9a-f]{64}$'))
    or (p_email_verified is true and (p_email_lookup_digest is null or p_email_lookup_digest !~ '^[0-9a-f]{64}$'))
    or (p_phone_verified is not true and p_email_verified is not true)
    or p_policy_acceptances is null or jsonb_typeof(p_policy_acceptances) <> 'array' then
    return query select 'not_claimable'::text, null::uuid, false, false, false;
    return;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_policy_acceptances) item
    where jsonb_typeof(item) <> 'object'
      or exists (
        select 1
        from jsonb_object_keys(
          case when jsonb_typeof(item) = 'object' then item else '{}'::jsonb end
        ) key
        where key not in ('kind', 'version')
      )
      or nullif(btrim(case when jsonb_typeof(item) = 'object' then item->>'kind' else null end), '') is null
      or (case when jsonb_typeof(item) = 'object' then item->>'kind' else null end) not in ('terms', 'privacy', 'marketing')
      or nullif(btrim(case when jsonb_typeof(item) = 'object' then item->>'version' else null end), '') is null
  ) then
    return query select 'not_claimable'::text, null::uuid, false, false, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array(
      btrim(p_firebase_uid),
      coalesce(v_phone_digest, ''),
      coalesce(v_email_digest, '')
    )::text,
    0
  ));

  select * into v_principal
  from public.customer_firebase_principals principal
  where principal.firebase_uid = btrim(p_firebase_uid)
  for update;
  if v_principal.id is not null then
    if v_principal.status <> 'active'
      or not exists (
        select 1 from public.customer_accounts account
        where account.id = v_principal.account_id and account.state = 'active'
      ) then
      return query select 'conflict'::text, null::uuid, false, false, false;
      return;
    end if;

    select * into v_candidate
    from public.customer_account_claim_candidates candidate
    where candidate.account_id = v_principal.account_id
      and candidate.status = 'claimed'
      and candidate.claimed_firebase_uid = btrim(p_firebase_uid)
    for update;
    if v_candidate.id is null then
      if exists (
        select 1 from public.customer_account_claim_candidates candidate
        where candidate.status in ('precreated_unclaimed', 'claim_in_progress', 'claimed')
          and (
            (
              v_phone_digest is not null
              and candidate.phone_lookup_digest = v_phone_digest
            ) or (
              v_email_digest is not null
              and candidate.email_lookup_digest = v_email_digest
            )
          )
      ) then
        return query select 'conflict'::text, null::uuid, false, false, false;
        return;
      end if;

      for v_identity in
        select * from public.customer_account_verified_identities verified_identity
        where verified_identity.status = 'active'
          and (
            (
              v_phone_digest is not null
              and verified_identity.kind = 'phone'
              and (
                verified_identity.lookup_digest = v_phone_digest
                or verified_identity.account_id = v_principal.account_id
              )
            ) or (
              v_email_digest is not null
              and verified_identity.kind = 'email'
              and (
                verified_identity.lookup_digest = v_email_digest
                or verified_identity.account_id = v_principal.account_id
              )
            )
          )
        for update
      loop
        if v_identity.account_id <> v_principal.account_id
          or (v_identity.kind = 'phone' and v_identity.lookup_digest <> v_phone_digest)
          or (v_identity.kind = 'email' and v_identity.lookup_digest <> v_email_digest) then
          return query select 'conflict'::text, null::uuid, false, false, false;
          return;
        end if;
      end loop;

      if v_phone_digest is not null then
        insert into public.customer_account_verified_identities(
          account_id, kind, lookup_digest, source
        )
        values (
          v_principal.account_id, 'phone', v_phone_digest, 'firebase_verified_claim'
        )
        on conflict do nothing;
      end if;
      if v_email_digest is not null then
        insert into public.customer_account_verified_identities(
          account_id, kind, lookup_digest, source
        )
        values (
          v_principal.account_id, 'email', v_email_digest, 'firebase_verified_claim'
        )
        on conflict do nothing;
      end if;

      for v_policy in
        select value from jsonb_array_elements(p_policy_acceptances) value
      loop
        v_policy_kind := btrim(v_policy->>'kind');
        v_policy_version := btrim(v_policy->>'version');
        insert into public.account_policy_acceptances(
          account_id, policy_kind, policy_version
        )
        values (
          v_principal.account_id, v_policy_kind, v_policy_version
        )
        on conflict do nothing;
      end loop;

      select
        exists (
          select 1 from public.customer_account_verified_identities verified_identity
          where verified_identity.account_id = v_principal.account_id
            and verified_identity.kind = 'phone'
            and verified_identity.status = 'active'
        ),
        exists (
          select 1 from public.customer_account_verified_identities verified_identity
          where verified_identity.account_id = v_principal.account_id
            and verified_identity.kind = 'email'
            and verified_identity.status = 'active'
        )
      into v_has_phone, v_has_email;

      return query select
        'already_claimed'::text,
        v_principal.account_id,
        v_has_phone,
        v_has_email,
        v_has_phone and v_has_email;
      return;
    end if;
    v_replay := true;
  else
    for v_match in
      select * from public.customer_account_claim_candidates candidate
      where (
        (
          v_phone_digest is not null
          and candidate.phone_lookup_digest = v_phone_digest
        ) or (
          v_email_digest is not null
          and candidate.email_lookup_digest = v_email_digest
        )
      )
      and candidate.status in ('precreated_unclaimed', 'claim_in_progress', 'claimed')
      order by candidate.created_at, candidate.id
      for update
    loop
      if v_candidate.id is null then
        v_candidate := v_match;
      elsif v_candidate.id <> v_match.id then
        return query select 'conflict'::text, null::uuid, false, false, false;
        return;
      end if;
    end loop;

    if v_candidate.id is null then
      return query select 'not_claimable'::text, null::uuid, false, false, false;
      return;
    end if;
    if v_candidate.status = 'claimed' then
      return query select 'conflict'::text, null::uuid, false, false, false;
      return;
    end if;
    if not exists (
      select 1 from public.customer_accounts account
      where account.id = v_candidate.account_id and account.state = 'active'
    ) then
      return query select 'not_claimable'::text, null::uuid, false, false, false;
      return;
    end if;

    select * into v_account_principal
    from public.customer_firebase_principals principal
    where principal.account_id = v_candidate.account_id
      and principal.status = 'active'
    for update;
    if v_account_principal.id is not null then
      return query select 'conflict'::text, null::uuid, false, false, false;
      return;
    end if;
  end if;

  if v_replay then
    for v_match in
      select * from public.customer_account_claim_candidates candidate
      where candidate.id <> v_candidate.id
        and candidate.status in ('precreated_unclaimed', 'claim_in_progress', 'claimed')
        and (
          (
            v_phone_digest is not null
            and candidate.phone_lookup_digest = v_phone_digest
          ) or (
            v_email_digest is not null
            and candidate.email_lookup_digest = v_email_digest
          )
        )
      order by candidate.created_at, candidate.id
      for update
    loop
      return query select 'conflict'::text, null::uuid, false, false, false;
      return;
    end loop;
  end if;

  for v_identity in
    select * from public.customer_account_verified_identities verified_identity
    where verified_identity.status = 'active'
      and (
        (
          v_phone_digest is not null
          and verified_identity.kind = 'phone'
          and (verified_identity.lookup_digest = v_phone_digest or verified_identity.account_id = v_candidate.account_id)
        ) or (
          v_email_digest is not null
          and verified_identity.kind = 'email'
          and (verified_identity.lookup_digest = v_email_digest or verified_identity.account_id = v_candidate.account_id)
        )
      )
    for update
  loop
    if v_identity.account_id <> v_candidate.account_id
      or (v_identity.kind = 'phone' and v_identity.lookup_digest <> v_phone_digest)
      or (v_identity.kind = 'email' and v_identity.lookup_digest <> v_email_digest) then
      return query select 'conflict'::text, null::uuid, false, false, false;
      return;
    end if;
  end loop;

  if not v_replay then
    insert into public.customer_firebase_principals(account_id, firebase_uid, status)
    values (v_candidate.account_id, btrim(p_firebase_uid), 'active');
  end if;

  if v_phone_digest is not null then
    insert into public.customer_account_verified_identities(account_id, kind, lookup_digest, source)
    values (v_candidate.account_id, 'phone', v_phone_digest, 'firebase_verified_claim')
    on conflict do nothing;
  end if;
  if v_email_digest is not null then
    insert into public.customer_account_verified_identities(account_id, kind, lookup_digest, source)
    values (v_candidate.account_id, 'email', v_email_digest, 'firebase_verified_claim')
    on conflict do nothing;
  end if;

  for v_policy in select value from jsonb_array_elements(p_policy_acceptances) value loop
    v_policy_kind := btrim(v_policy->>'kind');
    v_policy_version := btrim(v_policy->>'version');
    insert into public.account_policy_acceptances(account_id, policy_kind, policy_version)
    values (v_candidate.account_id, v_policy_kind, v_policy_version)
    on conflict do nothing;
  end loop;

  select item.id into v_item_id
  from public.customer_account_precreation_items item
  where item.batch_id = v_candidate.batch_id and item.source_digest = v_candidate.source_digest
  limit 1;

  if v_replay then
    insert into public.customer_account_precreation_audit(batch_id, item_id, event_type, result_code, event_digest)
    values (
      v_candidate.batch_id,
      v_item_id,
      'claim_replayed',
      'verified_identity_progress',
      coalesce(v_phone_digest, v_email_digest, v_candidate.source_digest)
    );
  else
    update public.customer_account_claim_candidates as candidate
    set status = 'claimed', claimed_firebase_uid = btrim(p_firebase_uid), claimed_at = now()
    where candidate.id = v_candidate.id;
    update public.customer_amis_links as link
    set state = 'active', verified_at = coalesce(link.verified_at, now()), revoked_at = null
    where link.id = v_candidate.amis_customer_link_id and link.account_id = v_candidate.account_id;
    update public.customer_account_precreation_items as item
    set result_code = 'claimed', result_reason = 'verified_phone_or_email', after_marker = 'claimed'
    where item.batch_id = v_candidate.batch_id and item.source_digest = v_candidate.source_digest;
    insert into public.customer_account_precreation_audit(batch_id, item_id, event_type, result_code, event_digest)
    values (v_candidate.batch_id, v_item_id, 'claim_succeeded', 'claimed', v_candidate.source_digest);
  end if;

  select
    exists (
      select 1 from public.customer_account_verified_identities verified_identity
      where verified_identity.account_id = v_candidate.account_id
        and verified_identity.kind = 'phone'
        and verified_identity.status = 'active'
    ),
    exists (
      select 1 from public.customer_account_verified_identities verified_identity
      where verified_identity.account_id = v_candidate.account_id
        and verified_identity.kind = 'email'
        and verified_identity.status = 'active'
    )
  into v_has_phone, v_has_email;

  return query select
    case when v_replay then 'already_claimed'::text else 'claimed'::text end,
    v_candidate.account_id,
    v_has_phone,
    v_has_email,
    v_has_phone and v_has_email;
end;
$function$;

create or replace function public.customer_account_identity_assurance(
  p_firebase_uid text
)
returns table(
  account_id uuid,
  registration_claimed boolean,
  phone_verified boolean,
  email_verified boolean,
  checkout_ready boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    principal.account_id,
    true,
    assurance.phone_verified,
    assurance.email_verified,
    assurance.phone_verified and assurance.email_verified
  from public.customer_firebase_principals principal
  join public.customer_accounts account
    on account.id = principal.account_id
   and account.state = 'active'
  cross join lateral (
    select
      exists (
        select 1 from public.customer_account_verified_identities verified_identity
        where verified_identity.account_id = principal.account_id
          and verified_identity.kind = 'phone'
          and verified_identity.status = 'active'
      ) as phone_verified,
      exists (
        select 1 from public.customer_account_verified_identities verified_identity
        where verified_identity.account_id = principal.account_id
          and verified_identity.kind = 'email'
          and verified_identity.status = 'active'
      ) as email_verified
  ) assurance
  where principal.firebase_uid = btrim(p_firebase_uid)
    and principal.status = 'active'
  limit 1;
$function$;

create or replace function public.reconcile_customer_account_precreation_batch(
  p_batch_id uuid,
  p_manifest_digest text
)
returns table(batch_status text, expected_count integer, processed_count integer, created_count integer, skipped_count integer, conflict_count integer, failed_count integer, drift_count integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_batch public.customer_account_precreation_batches%rowtype;
  v_processed integer;
  v_created integer;
  v_skipped integer;
  v_conflict integer;
  v_failed integer;
  v_drift integer;
  v_status text;
begin
  select * into v_batch from public.customer_account_precreation_batches where id = p_batch_id for update;
  if v_batch.id is null then raise exception 'precreation batch not found'; end if;
  if v_batch.manifest_digest <> p_manifest_digest then raise exception 'precreation manifest digest mismatch'; end if;

  select count(*) filter (where item.result_code in ('created', 'skipped', 'conflict', 'claimed', 'rolled_back')),
    count(*) filter (where item.result_code = 'created'),
    count(*) filter (where item.result_code = 'skipped'),
    count(*) filter (where item.result_code = 'conflict'),
    count(*) filter (where item.result_code = 'failed')
  into v_processed, v_created, v_skipped, v_conflict, v_failed
  from public.customer_account_precreation_items item
  where item.batch_id = p_batch_id;
  v_drift := greatest(v_batch.expected_count - v_processed, 0);
  v_status := case when v_drift = 0 and v_failed = 0 then 'reconciled' else 'failed' end;

  update public.customer_account_precreation_batches
  set status = v_status,
      created_count = v_created,
      skipped_count = v_skipped,
      conflict_count = v_conflict,
      completed_at = coalesce(completed_at, now()),
      reconciled_at = now()
  where id = p_batch_id;
  insert into public.customer_account_precreation_audit(batch_id, event_type, result_code, event_digest)
  values (p_batch_id, 'reconcile', v_status, p_manifest_digest);
  return query select v_status, v_batch.expected_count, v_processed, v_created, v_skipped, v_conflict, v_failed, v_drift;
end;
$function$;

create or replace function public.rollback_customer_account_precreation_batch(
  p_batch_id uuid,
  p_manifest_digest text
)
returns table(batch_status text, rolled_back_count integer, claimed_preserved_count integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_batch public.customer_account_precreation_batches%rowtype;
  v_rolled_back integer;
  v_claimed integer;
begin
  select * into v_batch from public.customer_account_precreation_batches where id = p_batch_id for update;
  if v_batch.id is null then raise exception 'precreation batch not found'; end if;
  if v_batch.manifest_digest <> p_manifest_digest then raise exception 'precreation manifest digest mismatch'; end if;

  select count(*) into v_claimed
  from public.customer_account_claim_candidates candidate
  where candidate.batch_id = p_batch_id and candidate.status = 'claimed';

  update public.customer_account_claim_candidates candidate
  set status = 'rolled_back'
  where candidate.batch_id = p_batch_id
    and candidate.status in ('precreated_unclaimed', 'claim_in_progress');
  get diagnostics v_rolled_back = row_count;

  update public.customer_amis_links link
  set state = 'revoked', revoked_at = coalesce(revoked_at, now())
  where link.id in (
    select candidate.amis_customer_link_id
    from public.customer_account_claim_candidates candidate
    where candidate.batch_id = p_batch_id and candidate.status = 'rolled_back'
  ) and link.state in ('verified', 'active');

  update public.customer_accounts account
  set state = 'disabled'
  where account.id in (
    select candidate.account_id
    from public.customer_account_claim_candidates candidate
    where candidate.batch_id = p_batch_id and candidate.status = 'rolled_back'
  ) and not exists (
    select 1 from public.customer_firebase_principals principal
    where principal.account_id = account.id and principal.status = 'active'
  );

  update public.customer_account_precreation_items item
  set result_code = 'rolled_back', result_reason = 'exact_batch_rollback', after_marker = 'rolled_back'
  where item.batch_id = p_batch_id
    and item.result_code in ('created', 'skipped')
    and exists (
      select 1 from public.customer_account_claim_candidates candidate
      where candidate.batch_id = p_batch_id
        and candidate.source_digest = item.source_digest
        and candidate.status = 'rolled_back'
    );

  update public.customer_account_precreation_batches
  set status = 'rolled_back', completed_at = coalesce(completed_at, now()), reconciled_at = now()
  where id = p_batch_id;
  insert into public.customer_account_precreation_audit(batch_id, event_type, result_code, event_digest)
  values (p_batch_id, 'rollback', 'rolled_back', p_manifest_digest);
  return query select 'rolled_back'::text, v_rolled_back, v_claimed;
end;
$function$;

revoke all on function public.begin_customer_account_precreation_batch(text, text, text, text, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.precreate_customer_account_item(uuid, text, integer, text, text, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.claim_customer_account_precreation(text, text, text, boolean, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.customer_account_identity_assurance(text) from public, anon, authenticated;
revoke all on function public.reconcile_customer_account_precreation_batch(uuid, text) from public, anon, authenticated;
revoke all on function public.rollback_customer_account_precreation_batch(uuid, text) from public, anon, authenticated;
grant execute on function public.begin_customer_account_precreation_batch(text, text, text, text, integer, text, timestamptz) to service_role;
grant execute on function public.precreate_customer_account_item(uuid, text, integer, text, text, text, text, timestamptz, uuid) to service_role;
grant execute on function public.claim_customer_account_precreation(text, text, text, boolean, boolean, jsonb) to service_role;
grant execute on function public.customer_account_identity_assurance(text) to service_role;
grant execute on function public.reconcile_customer_account_precreation_batch(uuid, text) to service_role;
grant execute on function public.rollback_customer_account_precreation_batch(uuid, text) to service_role;

comment on table public.customer_account_claim_candidates is 'One or two opaque AMIS identity digests for precreated accounts; no raw phone/email or Firebase credential is stored.';
comment on function public.customer_account_identity_assurance(text) is 'Service-role-only assurance: one verified identity claims registration; verified phone and email identities are required for checkout.';
comment on table public.customer_account_precreation_batches is 'Owner-approved local/staging/production manifest markers; production execution remains separately gated.';
comment on table public.customer_account_precreation_audit is 'Opaque batch/claim audit; event_digest is never raw PII, token, or OTP.';

commit;
