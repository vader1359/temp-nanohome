begin;

alter table public.customer_identity_ledger
  add column account_id uuid references public.customer_accounts(id) on delete restrict;

alter table public.customer_amis_links
  add column account_id uuid references public.customer_accounts(id) on delete restrict;

alter table public.customer_memory_projections
  add column account_id uuid references public.customer_accounts(id) on delete restrict;

update public.customer_identity_ledger ledger
set account_id = account.id
from public.customer_accounts account
where account.legacy_supabase_user_id = ledger.user_id;

update public.customer_amis_links link
set account_id = account.id
from public.customer_accounts account
where account.legacy_supabase_user_id = link.user_id;

update public.customer_memory_projections projection
set account_id = account.id
from public.customer_accounts account
where account.legacy_supabase_user_id = projection.user_id;

do $block$
begin
  if exists (
    select 1
    from public.customer_identity_ledger
    where user_id is not null and account_id is null
  ) then
    raise exception 'customer identity ledger backfill left legacy users without accounts';
  end if;

  if exists (
    select 1
    from public.customer_amis_links
    where account_id is null
  ) then
    raise exception 'AMIS link backfill left rows without accounts';
  end if;

  if exists (
    select 1
    from public.customer_memory_projections
    where account_id is null
  ) then
    raise exception 'customer memory projection backfill left rows without accounts';
  end if;
end;
$block$;

alter table public.customer_amis_links
  alter column user_id drop not null;

alter table public.customer_memory_projections
  alter column user_id drop not null;

alter table public.customer_identity_ledger
  add constraint customer_identity_ledger_account_overlap_check
    check (
      (user_id is null and account_id is null)
      or (user_id is not null and account_id is not null
        and public.is_legacy_account_ownership_valid(user_id, account_id))
    );

alter table public.customer_amis_links
  add constraint customer_amis_links_account_required_check check (account_id is not null),
  add constraint customer_amis_links_account_overlap_check
    check (user_id is null or public.is_legacy_account_ownership_valid(user_id, account_id)),
  add constraint customer_amis_links_id_account_unique unique (id, account_id),
  add constraint customer_amis_links_account_customer_unique unique (account_id, amis_customer_id);

alter table public.customer_memory_projections
  add constraint customer_memory_projections_account_required_check check (account_id is not null),
  add constraint customer_memory_projections_account_overlap_check
    check (user_id is null or public.is_legacy_account_ownership_valid(user_id, account_id));

alter table public.customer_memory_projections
  drop constraint if exists customer_memory_projections_link_id_fkey,
  add constraint customer_memory_projections_link_account_fkey
    foreign key (link_id, account_id)
    references public.customer_amis_links(id, account_id)
    on delete cascade;

create index customer_identity_ledger_account_recorded_idx
  on public.customer_identity_ledger(account_id, recorded_at desc, id desc)
  where account_id is not null;

create index customer_amis_links_account_state_idx
  on public.customer_amis_links(account_id, state, created_at desc);

create index customer_memory_projections_account_updated_idx
  on public.customer_memory_projections(account_id, updated_at desc);

create or replace function public.assign_customer_memory_account_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  legacy_account_id uuid;
begin
  if tg_op = 'UPDATE' and new.account_id is distinct from old.account_id then
    raise exception 'account ownership cannot be reassigned or detached'
      using errcode = 'P0001';
  end if;

  if new.user_id is not null then
    legacy_account_id := public.legacy_customer_account_id(new.user_id);
    if legacy_account_id is null then
      raise exception 'legacy user must map to an internal customer account'
        using errcode = 'P0001';
    end if;

    if new.account_id is null then
      new.account_id := legacy_account_id;
    elsif new.account_id <> legacy_account_id then
      raise exception 'legacy owner and account ownership must match'
        using errcode = 'P0001';
    end if;
  elsif tg_table_name in ('customer_amis_links', 'customer_memory_projections') and new.account_id is null then
    raise exception 'account ownership is required'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

create trigger assign_customer_identity_ledger_account_id
  before insert or update of account_id, user_id on public.customer_identity_ledger
  for each row execute function public.assign_customer_memory_account_id();

create trigger assign_customer_amis_link_account_id
  before insert or update of account_id, user_id on public.customer_amis_links
  for each row execute function public.assign_customer_memory_account_id();

create trigger assign_customer_memory_projection_account_id
  before insert or update of account_id, user_id on public.customer_memory_projections
  for each row execute function public.assign_customer_memory_account_id();

create or replace function public.bind_verified_customer_identity(
  p_visitor_id uuid,
  p_session_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_latest_kind text;
  v_latest_user_id uuid;
  v_latest_session_id uuid;
  v_account_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id::text, 0));

  if not exists (
    select 1
    from public.customer_visitors v
    join public.customer_sessions s on s.visitor_id = v.id
    where v.id = p_visitor_id
      and s.id = p_session_id
      and v.revoked_at is null
      and s.revoked_at is null
      and (v.expires_at is null or v.expires_at > now())
      and (s.expires_at is null or s.expires_at > now())
  ) then
    raise exception 'visitor and session are inactive';
  end if;

  v_account_id := public.legacy_customer_account_id(p_user_id);
  if p_user_id is null
    or not exists (select 1 from auth.users u where u.id = p_user_id)
    or v_account_id is null then
    raise exception 'verified auth user is required';
  end if;

  select l.identity_kind, l.user_id, l.session_id
  into v_latest_kind, v_latest_user_id, v_latest_session_id
  from public.customer_identity_ledger l
  where l.visitor_id = p_visitor_id
  order by l.recorded_at desc, l.id desc
  limit 1;

  if v_latest_kind = 'authenticated'
    and v_latest_user_id = p_user_id
    and v_latest_session_id = p_session_id then
    return 'unchanged';
  end if;

  if v_latest_kind = 'authenticated' and v_latest_user_id is distinct from p_user_id then
    delete from public.customer_preferences where visitor_id = p_visitor_id;
    delete from public.customer_recent_entities where visitor_id = p_visitor_id;
    delete from public.customer_affinities where visitor_id = p_visitor_id;
    delete from public.personalization_decisions where visitor_id = p_visitor_id;
  end if;

  insert into public.customer_identity_ledger(
    visitor_id, session_id, user_id, account_id, identity_kind, identity_value_hash, source
  ) values (
    p_visitor_id,
    p_session_id,
    p_user_id,
    v_account_id,
    'authenticated',
    encode(extensions.digest(p_user_id::text, 'sha256'), 'hex'),
    'verified_supabase_auth'
  );

  return 'bound';
end;
$function$;

drop policy if exists "customer memory projection own read" on public.customer_memory_projections;
create policy "customer memory projection own read"
on public.customer_memory_projections for select to authenticated
using (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(user_id, account_id)
);

revoke all on public.customer_identity_ledger, public.customer_amis_links,
  public.amis_customer_snapshots, public.amis_sale_order_summaries,
  public.amis_sync_cursors from public, anon, authenticated;
revoke all on public.customer_memory_projections from public, anon;
grant select on public.customer_memory_projections to authenticated;
revoke execute on function public.assign_customer_memory_account_id() from public, anon, authenticated;

comment on column public.customer_identity_ledger.account_id is 'Internal ownership for authenticated entries; anonymous visitor history remains unowned.';
comment on column public.customer_amis_links.account_id is 'Internal customer account owner; legacy user_id is overlap metadata only.';
comment on column public.customer_memory_projections.account_id is 'Internal customer account owner for browser-safe memory projections.';

commit;
