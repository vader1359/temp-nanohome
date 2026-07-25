create or replace function public.current_legacy_supabase_user_id()
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

  if subject is null
    or claim_role <> 'authenticated'
    or claim_issuer is null
    or claim_audience is null
    or subject !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  if exists (
    select 1
    from public.customer_accounts account
    join public.customer_identity_providers provider on provider.provider = 'supabase'
    where account.legacy_supabase_user_id = subject::uuid
      and account.state = 'active'
      and provider.issuer = claim_issuer
      and provider.audience = claim_audience
  ) then
    return subject::uuid;
  end if;

  return null;
end;
$$;

revoke execute on function public.current_legacy_supabase_user_id() from public, anon, authenticated;
grant execute on function public.current_legacy_supabase_user_id() to authenticated;

drop policy if exists "Users can select own carts" on public.carts;
create policy "Users can select own carts"
on public.carts for select to authenticated
using (
  account_id = (select public.current_customer_account_id())
  or user_id = (select public.current_legacy_supabase_user_id())
);

drop policy if exists "Users can update own carts" on public.carts;
create policy "Users can update own carts"
on public.carts for update to authenticated
using (
  account_id = (select public.current_customer_account_id())
  or user_id = (select public.current_legacy_supabase_user_id())
)
with check (
  account_id = (select public.current_customer_account_id())
  or user_id = (select public.current_legacy_supabase_user_id())
);

drop policy if exists "Users can delete own carts" on public.carts;
create policy "Users can delete own carts"
on public.carts for delete to authenticated
using (
  account_id = (select public.current_customer_account_id())
  or user_id = (select public.current_legacy_supabase_user_id())
);

drop policy if exists "Users can select items in own carts" on public.cart_items;
create policy "Users can select items in own carts"
on public.cart_items for select to authenticated
using (
  exists (
    select 1
    from public.carts cart
    where cart.id = cart_items.cart_id
      and (
        cart.account_id = (select public.current_customer_account_id())
        or cart.user_id = (select public.current_legacy_supabase_user_id())
      )
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
      and (
        cart.account_id = (select public.current_customer_account_id())
        or cart.user_id = (select public.current_legacy_supabase_user_id())
      )
  )
)
with check (
  exists (
    select 1
    from public.carts cart
    where cart.id = cart_items.cart_id
      and (
        cart.account_id = (select public.current_customer_account_id())
        or cart.user_id = (select public.current_legacy_supabase_user_id())
      )
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
      and (
        cart.account_id = (select public.current_customer_account_id())
        or cart.user_id = (select public.current_legacy_supabase_user_id())
      )
  )
);

drop policy if exists "Users can select own orders" on public.orders;
create policy "Users can select own orders"
on public.orders for select to authenticated
using (
  account_id = (select public.current_customer_account_id())
  or user_id = (select public.current_legacy_supabase_user_id())
);

drop policy if exists "Users can select items in own orders" on public.order_items;
create policy "Users can select items in own orders"
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_items.order_id
      and (
        order_row.account_id = (select public.current_customer_account_id())
        or order_row.user_id = (select public.current_legacy_supabase_user_id())
      )
  )
);

drop policy if exists "Users can select own order status history" on public.order_status_history;
create policy "Users can select own order status history"
on public.order_status_history for select to authenticated
using (
  exists (
    select 1
    from public.orders order_row
    where order_row.id = order_status_history.order_id
      and (
        order_row.account_id = (select public.current_customer_account_id())
        or order_row.user_id = (select public.current_legacy_supabase_user_id())
      )
  )
);

drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile"
on public.profiles for select to authenticated
using (
  account_id = (select public.current_customer_account_id())
  or id = (select public.current_legacy_supabase_user_id())
);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated
using (
  account_id = (select public.current_customer_account_id())
  or id = (select public.current_legacy_supabase_user_id())
)
with check (
  account_id = (select public.current_customer_account_id())
  or id = (select public.current_legacy_supabase_user_id())
);
