begin;

alter table public.carts
  add column version bigint not null default 0
  check (version >= 0);

alter table public.cart_items
  add constraint cart_items_quantity_max_check
  check (quantity between 1 and 10) not valid;

create unique index carts_account_id_unique
  on public.carts (account_id)
  where account_id is not null;

create table public.customer_cart_merge_receipts (
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  idempotency_key text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (account_id, idempotency_key),
  constraint customer_cart_merge_receipts_key_check
    check (octet_length(idempotency_key) between 1 and 120),
  constraint customer_cart_merge_receipts_result_check
    check (jsonb_typeof(result) = 'object')
);

alter table public.customer_cart_merge_receipts enable row level security;
revoke all on public.customer_cart_merge_receipts from public, anon, authenticated;
grant all on public.customer_cart_merge_receipts to service_role;

create or replace function public.mutate_customer_account_cart(
  p_account_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_expected_version bigint,
  p_operation text
)
returns table (result_status text, cart_version bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_cart_id uuid;
  v_version bigint;
  v_current_quantity integer;
  v_next_quantity integer;
  v_stock integer;
  v_cart_eligible boolean;
  v_changed integer := 0;
begin
  if p_account_id is null
    or p_variant_id is null
    or p_expected_version is null
    or p_expected_version < 0
    or p_operation not in ('add', 'update', 'remove')
    or (p_operation <> 'remove' and (p_quantity is null or p_quantity not between 1 and 10))
  then
    raise exception using errcode = 'P0001', message = 'cart_mutation_invalid';
  end if;

  if not exists (
    select 1 from public.customer_accounts account
    where account.id = p_account_id and account.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'cart_mutation_unauthorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));

  select cart.id, cart.version
  into v_cart_id, v_version
  from public.carts cart
  where cart.account_id = p_account_id
  for update;

  if v_cart_id is null then
    if p_expected_version <> 0 then
      return query select 'version_conflict'::text, 0::bigint;
      return;
    end if;
    if p_operation = 'remove' then
      return query select 'updated'::text, 0::bigint;
      return;
    end if;
    insert into public.carts (account_id)
    values (p_account_id)
    returning id, version into v_cart_id, v_version;
  end if;

  if v_version <> p_expected_version then
    return query select 'version_conflict'::text, v_version;
    return;
  end if;

  if p_operation = 'remove' then
    delete from public.cart_items item
    where item.cart_id = v_cart_id and item.variant_id = p_variant_id;
    get diagnostics v_changed = row_count;
  else
    select eligibility.cart, eligibility.stock
    into v_cart_eligible, v_stock
    from public.catalog_eligibility eligibility
    where eligibility.variant_id = p_variant_id;

    if v_cart_eligible is not true or coalesce(v_stock, 0) < 1 then
      return query select 'unavailable'::text, v_version;
      return;
    end if;

    select item.quantity
    into v_current_quantity
    from public.cart_items item
    where item.cart_id = v_cart_id and item.variant_id = p_variant_id;

    v_next_quantity := case
      when p_operation = 'add' then coalesce(v_current_quantity, 0) + p_quantity
      else p_quantity
    end;

    if v_next_quantity > least(10, v_stock) then
      return query select 'unavailable'::text, v_version;
      return;
    end if;

    insert into public.cart_items (cart_id, variant_id, quantity)
    values (v_cart_id, p_variant_id, v_next_quantity)
    on conflict (cart_id, variant_id) do update
    set quantity = excluded.quantity;
    v_changed := case when v_current_quantity is distinct from v_next_quantity then 1 else 0 end;
  end if;

  if v_changed > 0 then
    update public.carts
    set version = version + 1
    where id = v_cart_id
    returning version into v_version;
  end if;

  return query select 'updated'::text, v_version;
end;
$function$;

create or replace function public.merge_customer_guest_cart(
  p_account_id uuid,
  p_idempotency_key text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_cart_id uuid;
  v_version bigint;
  v_inserted integer;
  v_changed_lines integer := 0;
  v_removed_lines integer := 0;
  v_current_quantity integer;
  v_next_quantity integer;
  v_stock integer;
  v_cart_eligible boolean;
  v_result jsonb;
  v_item record;
begin
  if p_account_id is null
    or p_idempotency_key is null
    or octet_length(p_idempotency_key) not between 1 and 120
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 50
  then
    raise exception using errcode = 'P0001', message = 'guest_cart_merge_invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) <> 'object'
      or not (item ? 'variantId' and item ? 'quantity')
      or (select count(*) from jsonb_object_keys(item)) <> 2
      or coalesce(item ->> 'variantId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(item ->> 'quantity', '') !~ '^[1-9][0-9]?$'
      or (item ->> 'quantity')::integer not between 1 and 10
  ) then
    raise exception using errcode = 'P0001', message = 'guest_cart_merge_invalid';
  end if;

  if not exists (
    select 1 from public.customer_accounts account
    where account.id = p_account_id and account.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'guest_cart_merge_unauthorized';
  end if;

  insert into public.customer_cart_merge_receipts (account_id, idempotency_key)
  values (p_account_id, p_idempotency_key)
  on conflict (account_id, idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select receipt.result into v_result
    from public.customer_cart_merge_receipts receipt
    where receipt.account_id = p_account_id
      and receipt.idempotency_key = p_idempotency_key;
    return v_result;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));

  select cart.id, cart.version
  into v_cart_id, v_version
  from public.carts cart
  where cart.account_id = p_account_id
  for update;

  if v_cart_id is null then
    insert into public.carts (account_id)
    values (p_account_id)
    returning id, version into v_cart_id, v_version;
  end if;

  for v_item in
    select
      (item ->> 'variantId')::uuid as variant_id,
      least(10, sum((item ->> 'quantity')::integer))::integer as quantity
    from jsonb_array_elements(p_items) item
    group by (item ->> 'variantId')::uuid
    order by (item ->> 'variantId')::uuid
  loop
    select eligibility.cart, eligibility.stock
    into v_cart_eligible, v_stock
    from public.catalog_eligibility eligibility
    where eligibility.variant_id = v_item.variant_id;

    if v_cart_eligible is not true or coalesce(v_stock, 0) < 1 then
      v_removed_lines := v_removed_lines + 1;
      continue;
    end if;

    select item.quantity
    into v_current_quantity
    from public.cart_items item
    where item.cart_id = v_cart_id and item.variant_id = v_item.variant_id;

    v_next_quantity := least(
      10,
      v_stock,
      coalesce(v_current_quantity, 0) + v_item.quantity
    );

    if v_next_quantity is distinct from v_current_quantity then
      insert into public.cart_items (cart_id, variant_id, quantity)
      values (v_cart_id, v_item.variant_id, v_next_quantity)
      on conflict (cart_id, variant_id) do update
      set quantity = excluded.quantity;
      v_changed_lines := v_changed_lines + 1;
    end if;
  end loop;

  if v_changed_lines > 0 then
    update public.carts
    set version = version + 1
    where id = v_cart_id
    returning version into v_version;
  end if;

  v_result := jsonb_build_object(
    'changedLines', v_changed_lines,
    'removedLines', v_removed_lines,
    'version', v_version
  );

  update public.customer_cart_merge_receipts receipt
  set result = v_result
  where receipt.account_id = p_account_id
    and receipt.idempotency_key = p_idempotency_key;

  return v_result;
end;
$function$;

revoke all on function public.mutate_customer_account_cart(uuid, uuid, integer, bigint, text)
from public, anon, authenticated;
grant execute on function public.mutate_customer_account_cart(uuid, uuid, integer, bigint, text)
to service_role;
revoke all on function public.merge_customer_guest_cart(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.merge_customer_guest_cart(uuid, text, jsonb)
to service_role;

commit;
