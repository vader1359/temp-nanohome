create table public.customer_identity_providers (
  provider text primary key check (provider in ('firebase', 'supabase')),
  issuer text not null unique,
  audience text not null,
  created_at timestamptz not null default now(),
  check (
    provider <> 'firebase'
    or issuer = 'https://securetoken.google.com/' || audience
  )
);

create table public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  legacy_supabase_user_id uuid unique references auth.users(id) on delete set null,
  state text not null default 'active' check (state in ('active', 'disabled', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_firebase_principals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  firebase_uid text not null unique check (length(firebase_uid) between 1 and 256),
  status text not null default 'active' check (status in ('active', 'merged', 'disabled', 'deleted')),
  merged_into_account_id uuid references public.customer_accounts(id) on delete restrict,
  disabled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'merged') = (merged_into_account_id is not null)),
  check ((status = 'disabled') = (disabled_at is not null)),
  check ((status = 'deleted') = (deleted_at is not null))
);

create unique index customer_firebase_principals_one_active_per_account_idx
  on public.customer_firebase_principals(account_id)
  where status = 'active';

create table public.customer_auth_identities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  provider text not null references public.customer_identity_providers(provider) on delete restrict,
  subject text not null check (length(subject) between 1 and 256),
  status text not null default 'active' check (status in ('active', 'merged', 'disabled', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, subject)
);

create unique index customer_auth_identities_one_active_per_account_provider_idx
  on public.customer_auth_identities(account_id, provider)
  where status = 'active';

create table public.account_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  policy_kind text not null check (policy_kind in ('terms', 'privacy', 'marketing')),
  policy_version text not null check (length(policy_version) between 1 and 128),
  accepted_at timestamptz not null default now(),
  unique (account_id, policy_kind, policy_version)
);

create table public.customer_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  requested_at timestamptz not null default now(),
  status text not null default 'requested' check (status in ('requested', 'processing', 'completed', 'cancelled')),
  completed_at timestamptz,
  check ((status = 'completed') = (completed_at is not null))
);

insert into public.customer_accounts (legacy_supabase_user_id)
select u.id
from auth.users u
on conflict (legacy_supabase_user_id) do nothing;

create or replace function public.ensure_customer_account_for_legacy_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_accounts (legacy_supabase_user_id)
  values (new.id)
  on conflict (legacy_supabase_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_customer_account_for_legacy_user on auth.users;
create trigger ensure_customer_account_for_legacy_user
  after insert on auth.users
  for each row
  execute function public.ensure_customer_account_for_legacy_user();

create or replace function public.current_customer_account_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
  subject text;
  claim_role text;
  claim_issuer text;
  claim_audience text;
  account_id uuid;
begin
  begin
    claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    return null;
  end;

  subject := nullif(claims ->> 'sub', '');
  claim_role := nullif(claims ->> 'role', '');
  claim_issuer := nullif(claims ->> 'iss', '');
  claim_audience := nullif(claims ->> 'aud', '');

  if subject is null or claim_role <> 'authenticated' or claim_issuer is null or claim_audience is null then
    return null;
  end if;

  select principal.account_id
  into account_id
  from public.customer_firebase_principals principal
  join public.customer_accounts account on account.id = principal.account_id
  join public.customer_identity_providers provider on provider.provider = 'firebase'
  where principal.firebase_uid = subject
    and principal.status = 'active'
    and account.state = 'active'
    and provider.issuer = claim_issuer
    and provider.audience = claim_audience;

  if account_id is not null then
    return account_id;
  end if;

  if subject !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  select account.id
  into account_id
  from public.customer_accounts account
  join public.customer_identity_providers provider on provider.provider = 'supabase'
  where account.legacy_supabase_user_id = subject::uuid
    and account.state = 'active'
    and provider.issuer = claim_issuer
    and provider.audience = claim_audience;

  return account_id;
end;
$$;

alter table public.customer_identity_providers enable row level security;
alter table public.customer_accounts enable row level security;
alter table public.customer_firebase_principals enable row level security;
alter table public.customer_auth_identities enable row level security;
alter table public.account_policy_acceptances enable row level security;
alter table public.customer_account_deletion_requests enable row level security;

create policy customer_accounts_select_own
  on public.customer_accounts
  for select to authenticated
  using (id = (select public.current_customer_account_id()));

revoke all on public.customer_identity_providers,
  public.customer_firebase_principals,
  public.customer_auth_identities,
  public.account_policy_acceptances,
  public.customer_account_deletion_requests
from anon, authenticated;

revoke execute on function public.ensure_customer_account_for_legacy_user() from public, anon, authenticated;
revoke execute on function public.current_customer_account_id() from public, anon, authenticated;
grant select on public.customer_accounts to authenticated;
grant execute on function public.current_customer_account_id() to authenticated;
