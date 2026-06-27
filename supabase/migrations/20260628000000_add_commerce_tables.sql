create extension if not exists citext with schema public;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id text,
  merged_from_guest_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_check check (user_id is not null or guest_id is not null)
);

create unique index if not exists carts_user_id_unique on public.carts (user_id) where user_id is not null;
create unique index if not exists carts_guest_id_unique on public.carts (guest_id) where guest_id is not null;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_cart_variant_unique unique (cart_id, variant_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  user_id uuid references auth.users(id) on delete set null,
  email public.citext not null,
  full_name text not null,
  phone text not null,
  address text not null,
  city text,
  district text,
  ward text,
  note text,
  subtotal numeric(15,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'quote', 'confirmed', 'cancelled', 'fulfilled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.variants(id),
  product_name text,
  variant_name text,
  sku text,
  price numeric(15,2),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('pending', 'quote', 'confirmed', 'cancelled', 'fulfilled')),
  changed_by uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cart_items_cart_id_idx on public.cart_items (cart_id);
create index if not exists cart_items_variant_id_idx on public.cart_items (variant_id);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_order_number_idx on public.orders (order_number);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_variant_id_idx on public.order_items (variant_id);
create index if not exists order_status_history_order_id_idx on public.order_status_history (order_id);

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

drop trigger if exists touch_carts_updated_at on public.carts;
create trigger touch_carts_updated_at before update on public.carts for each row execute function public.touch_updated_at();
drop trigger if exists touch_cart_items_updated_at on public.cart_items;
create trigger touch_cart_items_updated_at before update on public.cart_items for each row execute function public.touch_updated_at();
drop trigger if exists touch_orders_updated_at on public.orders;
create trigger touch_orders_updated_at before update on public.orders for each row execute function public.touch_updated_at();

drop policy if exists "Users can select own carts" on public.carts;
create policy "Users can select own carts" on public.carts for select using (user_id = auth.uid());
drop policy if exists "Users can insert own carts" on public.carts;
create policy "Users can insert own carts" on public.carts for insert with check (user_id = auth.uid());
drop policy if exists "Users can update own carts" on public.carts;
create policy "Users can update own carts" on public.carts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can delete own carts" on public.carts;
create policy "Users can delete own carts" on public.carts for delete using (user_id = auth.uid());

drop policy if exists "Users can select items in own carts" on public.cart_items;
create policy "Users can select items in own carts" on public.cart_items for select using (exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid()));
drop policy if exists "Users can insert items in own carts" on public.cart_items;
create policy "Users can insert items in own carts" on public.cart_items for insert with check (exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid()));
drop policy if exists "Users can update items in own carts" on public.cart_items;
create policy "Users can update items in own carts" on public.cart_items for update using (exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid())) with check (exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid()));
drop policy if exists "Users can delete items in own carts" on public.cart_items;
create policy "Users can delete items in own carts" on public.cart_items for delete using (exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.user_id = auth.uid()));

drop policy if exists "Users can select own orders" on public.orders;
create policy "Users can select own orders" on public.orders for select using (user_id = auth.uid());
drop policy if exists "Guests can select order by order number setting" on public.orders;
create policy "Guests can select order by order number setting" on public.orders for select to anon using (user_id is null and order_number = current_setting('app.order_number', true));
drop policy if exists "Users and guests can insert orders" on public.orders;
create policy "Users and guests can insert orders" on public.orders for insert with check ((auth.uid() is not null and user_id = auth.uid()) or (auth.uid() is null and user_id is null and email is not null));

drop policy if exists "Users can select items in own orders" on public.order_items;
create policy "Users can select items in own orders" on public.order_items for select using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));
drop policy if exists "Guests can select items by order number setting" on public.order_items;
create policy "Guests can select items by order number setting" on public.order_items for select to anon using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id is null and orders.order_number = current_setting('app.order_number', true)));

drop policy if exists "Users can select own order status history" on public.order_status_history;
create policy "Users can select own order status history" on public.order_status_history for select using (exists (select 1 from public.orders where orders.id = order_status_history.order_id and orders.user_id = auth.uid()));
