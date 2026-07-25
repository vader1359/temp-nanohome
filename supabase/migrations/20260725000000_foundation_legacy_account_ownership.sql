alter table public.carts
  add column account_id uuid references public.customer_accounts(id) on delete restrict;

alter table public.orders
  add column account_id uuid references public.customer_accounts(id) on delete restrict;

alter table public.profiles
  add column account_id uuid references public.customer_accounts(id) on delete restrict;

update public.carts cart
set account_id = account.id
from public.customer_accounts account
where cart.user_id = account.legacy_supabase_user_id
  and cart.account_id is null;

update public.orders order_row
set account_id = account.id
from public.customer_accounts account
where order_row.user_id = account.legacy_supabase_user_id
  and order_row.account_id is null;

update public.profiles profile
set account_id = account.id
from public.customer_accounts account
where profile.id = account.legacy_supabase_user_id
  and profile.account_id is null;

create index carts_account_id_idx on public.carts (account_id) where account_id is not null;
create index orders_account_id_idx on public.orders (account_id) where account_id is not null;
create unique index profiles_account_id_unique on public.profiles (account_id) where account_id is not null;

create or replace function public.legacy_customer_account_id(p_legacy_supabase_user_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select account.id
  from public.customer_accounts account
  where account.legacy_supabase_user_id = p_legacy_supabase_user_id
$$;

create or replace function public.assign_legacy_account_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'profiles' then
    new.account_id := public.legacy_customer_account_id(new.id);
  else
    new.account_id := public.legacy_customer_account_id(new.user_id);
  end if;
  return new;
end;
$$;

create or replace function public.backfill_legacy_account_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.legacy_supabase_user_id is not null then
    update public.carts
    set account_id = new.id
    where user_id = new.legacy_supabase_user_id
      and account_id is null;

    update public.orders
    set account_id = new.id
    where user_id = new.legacy_supabase_user_id
      and account_id is null;

    update public.profiles
    set account_id = new.id
    where id = new.legacy_supabase_user_id
      and account_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_carts_legacy_account_id on public.carts;
create trigger assign_carts_legacy_account_id
  before insert or update of user_id on public.carts
  for each row execute function public.assign_legacy_account_id();

drop trigger if exists assign_orders_legacy_account_id on public.orders;
create trigger assign_orders_legacy_account_id
  before insert or update of user_id on public.orders
  for each row execute function public.assign_legacy_account_id();

drop trigger if exists assign_profiles_legacy_account_id on public.profiles;
create trigger assign_profiles_legacy_account_id
  before insert or update of id on public.profiles
  for each row execute function public.assign_legacy_account_id();

drop trigger if exists backfill_legacy_account_ownership on public.customer_accounts;
create trigger backfill_legacy_account_ownership
  after insert or update of legacy_supabase_user_id on public.customer_accounts
  for each row execute function public.backfill_legacy_account_ownership();

revoke execute on function public.legacy_customer_account_id(uuid) from public, anon, authenticated;
revoke execute on function public.assign_legacy_account_id() from public, anon, authenticated;
revoke execute on function public.backfill_legacy_account_ownership() from public, anon, authenticated;
