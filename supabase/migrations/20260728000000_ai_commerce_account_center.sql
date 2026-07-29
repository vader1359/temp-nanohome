begin;

create table public.customer_account_profiles (
  account_id uuid primary key references public.customer_accounts(id) on delete restrict,
  full_name text,
  date_of_birth date,
  nationality text,
  form_of_address text,
  preferred_locale text not null default 'vi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_account_profiles_full_name_check
    check (full_name is null or char_length(btrim(full_name)) between 1 and 200),
  constraint customer_account_profiles_nationality_check
    check (nationality is null or char_length(btrim(nationality)) between 1 and 100),
  constraint customer_account_profiles_form_of_address_check
    check (form_of_address is null or char_length(btrim(form_of_address)) between 1 and 50),
  constraint customer_account_profiles_locale_check
    check (preferred_locale in ('vi', 'en', 'ko'))
);

drop trigger if exists touch_customer_account_profiles_updated_at
on public.customer_account_profiles;
create trigger touch_customer_account_profiles_updated_at
  before update on public.customer_account_profiles
  for each row execute function public.touch_updated_at();

create table public.customer_wishlist_items (
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  variant_id uuid not null references public.variants(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (account_id, variant_id)
);

create index customer_wishlist_items_created_idx
  on public.customer_wishlist_items (account_id, created_at desc, variant_id);

create table public.customer_wishlist_merge_receipts (
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  idempotency_key text not null,
  variant_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (account_id, idempotency_key),
  constraint customer_wishlist_merge_receipts_key_check
    check (octet_length(idempotency_key) between 1 and 128),
  constraint customer_wishlist_merge_receipts_items_check
    check (cardinality(variant_ids) <= 50)
);

alter table public.customer_account_profiles enable row level security;
alter table public.customer_wishlist_items enable row level security;
alter table public.customer_wishlist_merge_receipts enable row level security;

create or replace function public.merge_customer_wishlist_items(
  p_account_id uuid,
  p_idempotency_key text,
  p_variant_ids uuid[]
)
returns table (variant_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_inserted integer;
  v_variant_ids uuid[];
begin
  if p_account_id is null
    or p_idempotency_key is null
    or octet_length(p_idempotency_key) not between 1 and 128
    or coalesce(cardinality(p_variant_ids), 0) > 50 then
    raise exception using errcode = 'P0001', message = 'wishlist_merge_invalid';
  end if;

  if not exists (
    select 1 from public.customer_accounts account
    where account.id = p_account_id and account.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'wishlist_merge_unauthorized';
  end if;

  insert into public.customer_wishlist_merge_receipts (
    account_id, idempotency_key, variant_ids
  ) values (
    p_account_id, p_idempotency_key, '{}'
  )
  on conflict (account_id, idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return query
      select unnest(receipt.variant_ids)
      from public.customer_wishlist_merge_receipts receipt
      where receipt.account_id = p_account_id
        and receipt.idempotency_key = p_idempotency_key;
    return;
  end if;

  insert into public.customer_wishlist_items (account_id, variant_id)
  select p_account_id, candidate.variant_id
  from (
    select distinct unnest(coalesce(p_variant_ids, '{}')) as variant_id
  ) candidate
  join public.catalog_eligibility eligibility
    on eligibility.variant_id = candidate.variant_id
   and eligibility.storefront is true
  on conflict (account_id, variant_id) do nothing;

  select coalesce(array_agg(item.variant_id order by item.variant_id), '{}')
  into v_variant_ids
  from public.customer_wishlist_items item
  where item.account_id = p_account_id;

  update public.customer_wishlist_merge_receipts receipt
  set variant_ids = v_variant_ids
  where receipt.account_id = p_account_id
    and receipt.idempotency_key = p_idempotency_key;

  return query select unnest(v_variant_ids);
end;
$function$;

create policy customer_account_profiles_select_own
  on public.customer_account_profiles for select to authenticated
  using (account_id = (select public.current_customer_account_id()));
create policy customer_account_profiles_insert_own
  on public.customer_account_profiles for insert to authenticated
  with check (account_id = (select public.current_customer_account_id()));
create policy customer_account_profiles_update_own
  on public.customer_account_profiles for update to authenticated
  using (account_id = (select public.current_customer_account_id()))
  with check (account_id = (select public.current_customer_account_id()));

create policy customer_wishlist_items_select_own
  on public.customer_wishlist_items for select to authenticated
  using (account_id = (select public.current_customer_account_id()));
create policy customer_wishlist_items_insert_own
  on public.customer_wishlist_items for insert to authenticated
  with check (account_id = (select public.current_customer_account_id()));
create policy customer_wishlist_items_delete_own
  on public.customer_wishlist_items for delete to authenticated
  using (account_id = (select public.current_customer_account_id()));

revoke all on public.customer_account_profiles,
  public.customer_wishlist_items,
  public.customer_wishlist_merge_receipts
from public, anon, authenticated;
grant select, insert, update on public.customer_account_profiles to authenticated;
grant select, insert, delete on public.customer_wishlist_items to authenticated;
grant all on public.customer_account_profiles,
  public.customer_wishlist_items,
  public.customer_wishlist_merge_receipts
to service_role;
revoke all on function public.merge_customer_wishlist_items(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.merge_customer_wishlist_items(uuid, text, uuid[]) to service_role;

commit;
