begin;

alter table public.carts drop constraint carts_owner_check;
alter table public.carts add constraint carts_owner_check
  check (user_id is not null or guest_id is not null or account_id is not null);

create or replace function public.assign_legacy_account_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  legacy_account_id uuid;
begin
  if tg_table_name = 'profiles' then
    legacy_account_id := public.legacy_customer_account_id(new.id);
  else
    legacy_account_id := public.legacy_customer_account_id(new.user_id);
  end if;

  if tg_op = 'UPDATE' and new.account_id is distinct from old.account_id then
    raise exception 'account ownership cannot be reassigned or detached'
      using errcode = 'P0001';
  end if;

  if legacy_account_id is not null then
    if new.account_id is null then
      new.account_id := legacy_account_id;
    elsif new.account_id <> legacy_account_id then
      raise exception 'legacy owner and account ownership must match'
        using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'carts' and new.account_id is null then
    new.account_id := public.current_customer_account_id();
  end if;

  return new;
end;
$function$;

drop trigger if exists assign_carts_legacy_account_id on public.carts;
create trigger assign_carts_legacy_account_id
  before insert or update of account_id, user_id on public.carts
  for each row execute function public.assign_legacy_account_id();

drop trigger if exists assign_orders_legacy_account_id on public.orders;
create trigger assign_orders_legacy_account_id
  before insert or update of account_id, user_id on public.orders
  for each row execute function public.assign_legacy_account_id();

drop trigger if exists assign_profiles_legacy_account_id on public.profiles;
create trigger assign_profiles_legacy_account_id
  before insert or update of account_id, id on public.profiles
  for each row execute function public.assign_legacy_account_id();

create or replace function public.is_legacy_account_ownership_valid(
  p_legacy_supabase_user_id uuid,
  p_account_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $function$
  select p_legacy_supabase_user_id is null
    or p_account_id = public.legacy_customer_account_id(p_legacy_supabase_user_id)
$function$;

revoke execute on function public.is_legacy_account_ownership_valid(uuid, uuid) from public, anon;
grant execute on function public.is_legacy_account_ownership_valid(uuid, uuid) to authenticated;

drop policy if exists "Users can select own carts" on public.carts;
create policy "Users can select own carts"
on public.carts for select to authenticated
using (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(user_id, account_id)
);

drop policy if exists "Users can insert own carts" on public.carts;
create policy "Users can insert own carts"
on public.carts for insert to authenticated
with check (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(user_id, account_id)
);

drop policy if exists "Users can update own carts" on public.carts;
create policy "Users can update own carts"
on public.carts for update to authenticated
using (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(user_id, account_id)
)
with check (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(user_id, account_id)
);

drop policy if exists "Users can delete own carts" on public.carts;
create policy "Users can delete own carts"
on public.carts for delete to authenticated
using (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(user_id, account_id)
);

drop policy if exists "Users can select items in own carts" on public.cart_items;
create policy "Users can select items in own carts"
on public.cart_items for select to authenticated
using (
  exists (
    select 1
    from public.carts cart
    where cart.id = cart_items.cart_id
      and cart.account_id = (select public.current_customer_account_id())
      and public.is_legacy_account_ownership_valid(cart.user_id, cart.account_id)
  )
);

drop policy if exists "Users can insert items in own carts" on public.cart_items;
create policy "Users can insert items in own carts"
on public.cart_items for insert to authenticated
with check (
  exists (
    select 1
    from public.carts cart
    where cart.id = cart_items.cart_id
      and cart.account_id = (select public.current_customer_account_id())
      and public.is_legacy_account_ownership_valid(cart.user_id, cart.account_id)
  )
);

drop policy if exists "Users can update items in own carts" on public.cart_items;
create policy "Users can update items in own carts"
on public.cart_items for update to authenticated
using (
  exists (
    select 1
    from public.carts cart
    where cart.id = cart_items.cart_id
      and cart.account_id = (select public.current_customer_account_id())
      and public.is_legacy_account_ownership_valid(cart.user_id, cart.account_id)
  )
)
with check (
  exists (
    select 1
    from public.carts cart
    where cart.id = cart_items.cart_id
      and cart.account_id = (select public.current_customer_account_id())
      and public.is_legacy_account_ownership_valid(cart.user_id, cart.account_id)
  )
);

drop policy if exists "Users can delete items in own carts" on public.cart_items;
create policy "Users can delete items in own carts"
on public.cart_items for delete to authenticated
using (
  exists (
    select 1
    from public.carts cart
    where cart.id = cart_items.cart_id
      and cart.account_id = (select public.current_customer_account_id())
      and public.is_legacy_account_ownership_valid(cart.user_id, cart.account_id)
  )
);

drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile"
on public.profiles for select to authenticated
using (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(id, account_id)
);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated
using (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(id, account_id)
)
with check (
  account_id = (select public.current_customer_account_id())
  and public.is_legacy_account_ownership_valid(id, account_id)
);

revoke execute on function public.assign_legacy_account_id() from public, anon, authenticated;

commit;
