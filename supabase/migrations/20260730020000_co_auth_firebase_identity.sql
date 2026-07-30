begin;

create table public.account_identity_events (
  id bigint generated always as identity primary key,
  account_id uuid references public.customer_accounts(id) on delete restrict,
  event_kind text not null check (
    event_kind in ('account_created', 'principal_replayed', 'identity_conflict')
  ),
  firebase_uid_digest text check (
    firebase_uid_digest is null
    or firebase_uid_digest ~ '^[0-9a-f]{64}$'
  ),
  identity_kind text check (
    identity_kind is null
    or identity_kind in ('email', 'phone')
  ),
  identity_digest text check (
    identity_digest is null
    or identity_digest ~ '^[0-9a-f]{64}$'
  ),
  reason_code text not null check (length(reason_code) between 1 and 128),
  idempotency_key_digest text not null check (
    idempotency_key_digest ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz not null default now()
);

create unique index account_identity_events_idempotency_idx
  on public.account_identity_events(idempotency_key_digest, event_kind);

create or replace function public.resolve_or_create_account(
  p_firebase_uid text,
  p_email_digest text,
  p_phone_digest text,
  p_idempotency_key text,
  p_policy_versions jsonb
)
returns table(account_id uuid, outcome text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_id uuid;
  v_idempotency_digest text;
  v_identity_account_id uuid;
  v_principal public.customer_firebase_principals%rowtype;
  v_uid_digest text;
begin
  if nullif(btrim(p_firebase_uid), '') is null
    or length(p_firebase_uid) > 256
    or (p_email_digest is null and p_phone_digest is null)
    or (
      p_email_digest is not null
      and p_email_digest !~ '^[0-9a-f]{64}$'
    )
    or (
      p_phone_digest is not null
      and p_phone_digest !~ '^[0-9a-f]{64}$'
    )
    or nullif(btrim(p_idempotency_key), '') is null
    or jsonb_typeof(p_policy_versions) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'identity_resolution_invalid';
  end if;

  v_idempotency_digest := encode(
    extensions.digest(p_idempotency_key, 'sha256'),
    'hex'
  );
  v_uid_digest := encode(
    extensions.digest(p_firebase_uid, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('firebase:' || p_firebase_uid, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'verified-identities:'
      || coalesce(p_email_digest, '')
      || ':'
      || coalesce(p_phone_digest, ''),
    0
  ));

  select event.account_id
  into v_account_id
  from public.account_identity_events event
  join public.customer_accounts account
    on account.id = event.account_id
   and account.state = 'active'
  join public.customer_firebase_principals principal
    on principal.account_id = event.account_id
   and principal.firebase_uid = p_firebase_uid
   and principal.status = 'active'
  where event.idempotency_key_digest = v_idempotency_digest
  order by event.id desc
  limit 1;
  if v_account_id is not null then
    return query select
      v_account_id,
      case
        when exists (
          select 1
          from public.account_identity_events event
          where event.account_id = v_account_id
            and event.idempotency_key_digest = v_idempotency_digest
            and event.event_kind = 'account_created'
        )
          then 'created'::text
        else 'existing_principal'::text
      end;
    return;
  end if;

  select *
  into v_principal
  from public.customer_firebase_principals principal
  where principal.firebase_uid = p_firebase_uid
  for update;

  if v_principal.id is not null then
    if v_principal.status <> 'active'
      or not exists (
        select 1
        from public.customer_accounts account
        where account.id = v_principal.account_id
          and account.state = 'active'
      ) then
      raise exception using
        errcode = 'P0001',
        message = 'identity_conflict';
    end if;
    v_account_id := v_principal.account_id;
  else
    if exists (
      select 1
      from public.customer_account_claim_candidates candidate
      where candidate.status in (
        'precreated_unclaimed',
        'claim_in_progress',
        'claimed'
      )
        and (
          (
            p_email_digest is not null
            and candidate.email_lookup_digest = p_email_digest
          )
          or (
            p_phone_digest is not null
            and candidate.phone_lookup_digest = p_phone_digest
          )
        )
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'identity_conflict';
    end if;

    insert into public.customer_accounts(state)
    values ('active')
    returning id into v_account_id;

    insert into public.customer_firebase_principals(
      account_id,
      firebase_uid,
      status
    )
    values (
      v_account_id,
      p_firebase_uid,
      'active'
    );
  end if;

  if exists (
    select 1
    from public.customer_account_claim_candidates candidate
    where candidate.account_id <> v_account_id
      and candidate.status in (
        'precreated_unclaimed',
        'claim_in_progress',
        'claimed'
      )
      and (
        (
          p_email_digest is not null
          and candidate.email_lookup_digest = p_email_digest
        )
        or (
          p_phone_digest is not null
          and candidate.phone_lookup_digest = p_phone_digest
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'identity_conflict';
  end if;

  select verified_identity.account_id
  into v_identity_account_id
  from public.customer_account_verified_identities verified_identity
  where verified_identity.status = 'active'
    and (
      (
        p_email_digest is not null
        and verified_identity.kind = 'email'
        and verified_identity.lookup_digest = p_email_digest
      )
      or (
        p_phone_digest is not null
        and verified_identity.kind = 'phone'
        and verified_identity.lookup_digest = p_phone_digest
      )
    )
    and verified_identity.account_id <> v_account_id
  limit 1
  for update;
  if v_identity_account_id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'identity_conflict';
  end if;

  if exists (
    select 1
    from public.customer_account_verified_identities verified_identity
    where verified_identity.account_id = v_account_id
      and verified_identity.status = 'active'
      and (
        (
          p_email_digest is not null
          and verified_identity.kind = 'email'
          and verified_identity.lookup_digest <> p_email_digest
        )
        or (
          p_phone_digest is not null
          and verified_identity.kind = 'phone'
          and verified_identity.lookup_digest <> p_phone_digest
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'identity_conflict';
  end if;

  insert into public.customer_account_verified_identities(
    account_id,
    kind,
    lookup_digest,
    source
  )
  select
    v_account_id,
    'email',
    p_email_digest,
    'firebase_verified_claim'
  where p_email_digest is not null
  on conflict do nothing;

  insert into public.customer_account_verified_identities(
    account_id,
    kind,
    lookup_digest,
    source
  )
  select
    v_account_id,
    'phone',
    p_phone_digest,
    'firebase_verified_claim'
  where p_phone_digest is not null
  on conflict do nothing;

  insert into public.account_identity_events(
    account_id,
    event_kind,
    firebase_uid_digest,
    reason_code,
    idempotency_key_digest
  )
  values (
    v_account_id,
    case
      when v_principal.id is null then 'account_created'
      else 'principal_replayed'
    end,
    v_uid_digest,
    case
      when v_principal.id is null then 'no_customer_match'
      else 'existing_principal'
    end,
    v_idempotency_digest
  )
  on conflict do nothing;

  return query select
    v_account_id,
    case
      when v_principal.id is null then 'created'::text
      else 'existing_principal'::text
    end;
end;
$function$;

alter table public.account_identity_events enable row level security;

revoke all on public.account_identity_events
from public, anon, authenticated;
revoke all on function public.resolve_or_create_account(
  text,
  text,
  text,
  text,
  jsonb
)
from public, anon, authenticated;

grant all on public.account_identity_events to service_role;
grant execute on function public.resolve_or_create_account(
  text,
  text,
  text,
  text,
  jsonb
)
to service_role;

comment on table public.account_identity_events is
  'Append-only identity audit containing opaque digests only; raw phone, email, tokens, OTPs, and provider payloads are excluded.';
comment on function public.resolve_or_create_account(
  text,
  text,
  text,
  text,
  jsonb
) is
  'Creates only non-CRM accounts after Customers-only claim resolution; verified identities use the shared HMAC-SHA256 NUL domain.';

commit;
