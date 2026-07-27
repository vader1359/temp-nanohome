begin;

-- Plan 02 durable order identity: server-owned account or opaque guest scope.
-- Legacy `user_id`, `order_number`, `status`, and `subtotal` are retained as
-- overlap columns; `email` stays non-null until external SePay/AMIS proof.

alter table public.orders
  add column owner_scope text,
  add column guest_owner_id uuid,
  add column guest_owner_token_digest text,
  add column guest_owner_token_expires_at timestamptz,
  add column order_kind text not null default 'quote_request',
  add column web_order_number text,
  add column idempotency_key text,
  add column currency text not null default 'VND',
  add column grand_total numeric(15,2) not null default 0,
  add column price_snapshot jsonb not null default '[]'::jsonb,
  add column business_status text not null default 'created',
  add column inventory_status text not null default 'unreserved',
  add column amis_export_status text not null default 'pending',
  add column payment_status text not null default 'unpaid',
  add column fulfillment_status text not null default 'unfulfilled',
  add column refund_status text not null default 'none';

update public.orders
set owner_scope = case
      when account_id is not null or user_id is not null then 'auth'
      else 'guest'
    end,
    web_order_number = coalesce(
      web_order_number,
      'WEB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20))
    ),
    grand_total = subtotal
where owner_scope is null;

alter table public.orders
  alter column owner_scope set not null,
  alter column web_order_number set not null;

alter table public.orders
  add constraint orders_owner_scope_check check (owner_scope in ('auth', 'guest')),
  add constraint orders_order_kind_check check (order_kind in ('quote_request', 'paid_order')),
  add constraint orders_currency_check check (currency = 'VND'),
  add constraint orders_grand_total_check check (grand_total >= 0),
  add constraint orders_price_snapshot_array_check check (jsonb_typeof(price_snapshot) = 'array'),
  add constraint orders_web_order_number_format_check
    check (web_order_number collate "C" ~ '^WEB-[A-Za-z0-9][A-Za-z0-9_-]*$'),
  add constraint orders_idempotency_key_nonempty_check
    check (idempotency_key is null or octet_length(idempotency_key) > 0),
  add constraint orders_business_status_check
    check (business_status in ('created', 'confirmed', 'cancelled', 'fulfilled')),
  add constraint orders_inventory_status_check
    check (inventory_status in ('unreserved', 'held', 'released', 'expired', 'committed')),
  add constraint orders_amis_export_status_check
    check (amis_export_status in ('pending', 'draft_created', 'approved', 'failed', 'skipped')),
  add constraint orders_payment_status_check
    check (payment_status in ('unpaid', 'authorized', 'paid', 'failed', 'cancelled')),
  add constraint orders_fulfillment_status_check
    check (fulfillment_status in ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled')),
  add constraint orders_refund_status_check
    check (refund_status in ('none', 'requested', 'partial', 'refunded', 'failed')),
  add constraint orders_authenticated_owner_shape_check check (
    owner_scope <> 'auth'
    or (
      (account_id is not null or user_id is not null)
      and guest_owner_id is null
      and guest_owner_token_digest is null
      and guest_owner_token_expires_at is null
    )
  ),
  add constraint orders_guest_owner_shape_check check (
    owner_scope <> 'guest'
    or (
      account_id is null
      and user_id is null
      and (
        (guest_owner_id is null and guest_owner_token_digest is null
          and guest_owner_token_expires_at is null)
        or (
          guest_owner_id is not null
          and guest_owner_token_digest ~ '^[0-9a-f]{64}$'
          and guest_owner_token_expires_at is not null
          and guest_owner_token_expires_at >= created_at
        )
      )
    )
  );

create unique index orders_web_order_number_unique
  on public.orders (web_order_number collate "C");
create unique index orders_guest_owner_id_unique
  on public.orders (guest_owner_id)
  where guest_owner_id is not null;
create unique index orders_account_idempotency_key_unique
  on public.orders (account_id, idempotency_key collate "C")
  where account_id is not null and idempotency_key is not null;
create unique index orders_guest_idempotency_key_unique
  on public.orders (guest_owner_id, idempotency_key collate "C")
  where guest_owner_id is not null and idempotency_key is not null;

alter table public.order_status_history
  add column actor_kind text not null default 'system',
  add column actor_account_id uuid references public.customer_accounts(id) on delete restrict,
  add column actor_staff_id text;

update public.order_status_history history
set actor_kind = 'account',
    actor_account_id = account.id
from public.customer_accounts account
where history.changed_by is not null
  and account.legacy_supabase_user_id = history.changed_by;

alter table public.order_status_history
  add constraint order_status_history_actor_kind_check
    check (actor_kind in ('account', 'staff', 'system')),
  add constraint order_status_history_actor_shape_check check (
    (actor_kind = 'account' and actor_account_id is not null and actor_staff_id is null)
    or (actor_kind = 'staff' and actor_staff_id is not null and actor_account_id is null)
    or (actor_kind = 'system' and actor_account_id is null and actor_staff_id is null)
  ),
  add constraint order_status_history_actor_staff_id_nonempty_check
    check (actor_staff_id is null or length(btrim(actor_staff_id)) between 1 and 256);

create index order_status_history_actor_account_idx
  on public.order_status_history (actor_account_id)
  where actor_account_id is not null;

create or replace function public.assign_order_status_actor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  legacy_account_id uuid;
begin
  if new.actor_kind = 'system' and new.actor_account_id is null and new.changed_by is not null then
    legacy_account_id := public.legacy_customer_account_id(new.changed_by);

    if legacy_account_id is null then
      raise exception 'legacy order status actor must map to an internal account'
        using errcode = 'P0001';
    end if;

    new.actor_kind := 'account';
    new.actor_account_id := legacy_account_id;
  end if;

  if new.actor_kind = 'account'
    and new.changed_by is not null
    and new.actor_account_id is distinct from public.legacy_customer_account_id(new.changed_by) then
    raise exception 'legacy order status actor and account actor must match'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists assign_order_status_actor on public.order_status_history;
create trigger assign_order_status_actor
  before insert on public.order_status_history
  for each row execute function public.assign_order_status_actor();

create or replace function public.assign_order_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.owner_scope is null then
    new.owner_scope := case
      when new.account_id is not null or new.user_id is not null then 'auth'
      else 'guest'
    end;
  end if;

  if new.web_order_number is null then
    new.web_order_number := 'WEB-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
  end if;

  return new;
end;
$function$;

drop trigger if exists assign_order_identity on public.orders;
create trigger assign_order_identity
  before insert on public.orders
  for each row execute function public.assign_order_identity();

-- SECURITY INVOKER so `current_user` reflects the actual browser role.
create or replace function public.prevent_order_identity_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  if new.owner_scope is distinct from old.owner_scope
    or new.guest_owner_id is distinct from old.guest_owner_id
    or new.web_order_number is distinct from old.web_order_number
    or new.order_number is distinct from old.order_number then
    raise exception 'order owner scope and identity cannot be reassigned'
      using errcode = 'P0001';
  end if;

  if current_user in ('anon', 'authenticated')
    and (
      new.subtotal is distinct from old.subtotal
      or new.grand_total is distinct from old.grand_total
      or new.currency is distinct from old.currency
      or new.price_snapshot is distinct from old.price_snapshot
      or new.order_kind is distinct from old.order_kind
      or new.payment_status is distinct from old.payment_status
      or new.refund_status is distinct from old.refund_status
      or new.amis_export_status is distinct from old.amis_export_status
      or new.guest_owner_token_digest is distinct from old.guest_owner_token_digest
    ) then
    raise exception 'server owned order fields cannot be mutated by browser roles'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists prevent_order_identity_mutation on public.orders;
create trigger prevent_order_identity_mutation
  before update on public.orders
  for each row execute function public.prevent_order_identity_mutation();

create or replace function public.verify_order_guest_scope(
  p_order_id uuid,
  p_guest_owner_id uuid,
  p_guest_token text
)
returns uuid
language sql
security definer
set search_path = pg_catalog, public, extensions
stable
as $function$
  select order_row.id
  from public.orders order_row
  where order_row.id = p_order_id
    and p_guest_owner_id is not null
    and p_guest_token is not null
    and order_row.owner_scope = 'guest'
    and order_row.account_id is null
    and order_row.user_id is null
    and order_row.guest_owner_id = p_guest_owner_id
    and order_row.guest_owner_token_expires_at > now()
    and order_row.guest_owner_token_digest = encode(extensions.digest(p_guest_token, 'sha256'), 'hex')
$function$;

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
as $function$
declare
  v_user_id uuid;
  v_account_id uuid;
  v_cart_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_web_order_number text;
  v_subtotal numeric(15,2);
  v_order_kind text;
  v_price_snapshot jsonb;
begin
  -- A non-UUID Firebase subject must not raise a cast error here.
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  v_account_id := public.current_customer_account_id();

  if v_account_id is null and v_user_id is not null then
    v_account_id := public.legacy_customer_account_id(v_user_id);
  end if;

  if v_account_id is null then
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
  where c.account_id = v_account_id
     or (v_user_id is not null and c.user_id = v_user_id)
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

  select sum(v.price * ci.quantity),
         jsonb_agg(
           jsonb_build_object(
             'variantId', v.id,
             'sku', v.sku,
             'unitPrice', v.price,
             'quantity', ci.quantity,
             'currency', 'VND'
           )
           order by v.id
         )
  into v_subtotal, v_price_snapshot
  from public.cart_items as ci
  join public.variants as v on v.id = ci.variant_id
  where ci.cart_id = v_cart_id;

  -- checkout_invalid_cart above already rejects any line without a fixed server price.
  v_order_kind := 'paid_order';

  v_order_number := concat(
    'ORD-',
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    '-',
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
  );

  v_web_order_number := 'WEB-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));

  insert into public.orders (
    order_number, web_order_number, account_id, user_id, owner_scope, order_kind,
    idempotency_key, email, full_name, phone, address, city, district, ward, note,
    subtotal, grand_total, currency, price_snapshot, status
  ) values (
    v_order_number, v_web_order_number, v_account_id, v_user_id, 'auth', v_order_kind,
    v_web_order_number, p_email, p_full_name, p_phone, p_address, p_city, p_district, p_ward, p_note,
    v_subtotal, v_subtotal, 'VND', coalesce(v_price_snapshot, '[]'::jsonb), 'pending'
  ) returning id into v_order_id;

  insert into public.order_items (order_id, variant_id, product_name, variant_name, sku, price, quantity)
  select v_order_id, v.id, p.name, v.name, v.sku, v.price, ci.quantity
  from public.cart_items as ci
  join public.variants as v on v.id = ci.variant_id
  join public.products as p on p.id = v.product_id
  where ci.cart_id = v_cart_id;

  insert into public.order_status_history (order_id, status, changed_by, actor_kind, actor_account_id)
  values (v_order_id, 'pending', v_user_id, 'account', v_account_id);

  delete from public.cart_items as ci
  where ci.cart_id = v_cart_id;

  return query select v_order_id, v_order_number;
end;
$function$;

-- Order number, email, and phone are not authorization keys.
drop policy if exists "Guests can select order by order number setting" on public.orders;
drop policy if exists "Guests can select items by order number setting" on public.order_items;
drop policy if exists "Users and guests can insert orders" on public.orders;

revoke insert, update, delete on public.orders, public.order_items, public.order_status_history
  from public, anon, authenticated;
grant all on public.orders, public.order_items, public.order_status_history to service_role;

revoke execute on function public.assign_order_identity() from public, anon, authenticated;
revoke execute on function public.assign_order_status_actor() from public, anon, authenticated;
revoke execute on function public.prevent_order_identity_mutation() from public, anon, authenticated;
revoke execute on function public.verify_order_guest_scope(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.verify_order_guest_scope(uuid, uuid, text) to service_role;

revoke all on function public.capture_order_from_cart(text, text, text, text, text, text, text, text) from public;
revoke all on function public.capture_order_from_cart(text, text, text, text, text, text, text, text) from anon;
grant execute on function public.capture_order_from_cart(text, text, text, text, text, text, text, text) to authenticated;

comment on column public.orders.owner_scope is 'Immutable server-owned scope: internal account ownership or opaque guest ownership.';
comment on column public.orders.guest_owner_id is 'Random server-generated guest owner ID carried in a signed HTTP-only cookie; never a browser input.';
comment on column public.orders.guest_owner_token_digest is 'SHA-256 digest of a short-lived guest order access token; raw tokens are never stored.';
comment on column public.orders.web_order_number is 'Human-facing WEB-* order number; it is presentation only and never authorizes access.';
comment on column public.orders.price_snapshot is 'Server price and SKU snapshot; browser roles cannot write or mutate it.';
comment on column public.orders.email is 'Non-null until the external SePay and AMIS contracts prove an absent email is accepted.';
comment on function public.verify_order_guest_scope(uuid, uuid, text) is 'Server-only guest order resolver requiring both the opaque owner ID and an exact token digest.';

commit;
