create or replace function public.capture_order_from_cart(
  p_full_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_city text default null,
  p_district text default null,
  p_ward text default null,
  p_note text default null
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(15,2);
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'checkout_unauthorized';
  end if;

  if p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 200
    or p_email is null or char_length(btrim(p_email)) not between 1 and 320
    or btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or p_phone is null or char_length(btrim(p_phone)) not between 1 and 50
    or p_address is null or char_length(btrim(p_address)) not between 1 and 500
    or (p_city is not null and char_length(btrim(p_city)) not between 1 and 100)
    or (p_district is not null and char_length(btrim(p_district)) not between 1 and 100)
    or (p_ward is not null and char_length(btrim(p_ward)) not between 1 and 100)
    or (p_note is not null and char_length(btrim(p_note)) not between 1 and 1000)
  then
    raise exception using errcode = 'P0001', message = 'checkout_invalid_delivery';
  end if;

  select c.id
  into v_cart_id
  from public.carts as c
  where c.user_id = v_user_id
  for update;

  if v_cart_id is null then
    raise exception using errcode = 'P0001', message = 'checkout_cart_not_found';
  end if;

  perform 1
  from public.cart_items as ci
  where ci.cart_id = v_cart_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'checkout_empty_cart';
  end if;

  perform 1
  from public.cart_items as ci
  join public.variants as v on v.id = ci.variant_id
  join public.products as p on p.id = v.product_id
  where ci.cart_id = v_cart_id
  for share of ci, v, p;

  if exists (
    select 1
    from public.cart_items as ci
    left join public.variants as v on v.id = ci.variant_id
    left join public.products as p on p.id = v.product_id
    where ci.cart_id = v_cart_id
      and (v.id is null or p.id is null or v.in_stock is not true or v.price is null)
  ) then
    raise exception using errcode = 'P0001', message = 'checkout_invalid_cart';
  end if;

  select sum(v.price * ci.quantity)
  into v_subtotal
  from public.cart_items as ci
  join public.variants as v on v.id = ci.variant_id
  where ci.cart_id = v_cart_id;

  v_order_number := concat(
    'ORD-',
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    '-',
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
  );

  insert into public.orders (
    order_number, user_id, email, full_name, phone, address, city, district, ward, note, subtotal, status
  ) values (
    v_order_number, v_user_id, p_email, p_full_name, p_phone, p_address, p_city, p_district, p_ward, p_note,
    v_subtotal, 'pending'
  ) returning id into v_order_id;

  insert into public.order_items (order_id, variant_id, product_name, variant_name, sku, price, quantity)
  select v_order_id, v.id, p.name, v.name, v.sku, v.price, ci.quantity
  from public.cart_items as ci
  join public.variants as v on v.id = ci.variant_id
  join public.products as p on p.id = v.product_id
  where ci.cart_id = v_cart_id;

  insert into public.order_status_history (order_id, status, changed_by)
  values (v_order_id, 'pending', v_user_id);

  delete from public.cart_items as ci
  where ci.cart_id = v_cart_id;

  return query select v_order_id, v_order_number;
end;
$$;

revoke all on function public.capture_order_from_cart(text, text, text, text, text, text, text, text) from public;
revoke all on function public.capture_order_from_cart(text, text, text, text, text, text, text, text) from anon;
grant execute on function public.capture_order_from_cart(text, text, text, text, text, text, text, text) to authenticated;
