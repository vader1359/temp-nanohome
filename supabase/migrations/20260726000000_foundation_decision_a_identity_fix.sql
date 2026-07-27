begin;

lock table auth.users in share row exclusive mode;
lock table public.customer_accounts in access exclusive mode;

create temporary table foundation_decision_a_fk_manifest on commit drop as
select constraint_row.oid as constraint_oid,
       constraint_row.conname as constraint_name,
       child_namespace.nspname as child_schema,
       child_relation.relname as child_table,
       child_attribute.attname as child_column,
       parent_attribute.attname as parent_column,
        cardinality(constraint_row.conkey) as child_key_count,
        cardinality(constraint_row.confkey) as parent_key_count,
       constraint_row.confdeltype,
       constraint_row.confupdtype,
       constraint_row.condeferrable,
       constraint_row.condeferred,
       pg_get_constraintdef(constraint_row.oid, true) as constraint_definition
from pg_constraint constraint_row
join pg_class child_relation on child_relation.oid = constraint_row.conrelid
join pg_namespace child_namespace on child_namespace.oid = child_relation.relnamespace
left join pg_attribute child_attribute
  on child_attribute.attrelid = constraint_row.conrelid
 and child_attribute.attnum = constraint_row.conkey[1]
left join pg_attribute parent_attribute
  on parent_attribute.attrelid = constraint_row.confrelid
 and parent_attribute.attnum = constraint_row.confkey[1]
where constraint_row.contype = 'f'
  and constraint_row.confrelid = 'public.customer_accounts'::regclass;

do $preflight$
declare
  reference_row record;
  orphan_count bigint;
begin
  if exists (
    with expected(constraint_name, child_schema, child_table, child_column, parent_column, confdeltype, confupdtype, condeferrable, condeferred) as (
      values
        ('account_policy_acceptances_account_id_fkey', 'public', 'account_policy_acceptances', 'account_id', 'id', 'r'::"char", 'a'::"char", false, false),
        ('carts_account_id_fkey', 'public', 'carts', 'account_id', 'id', 'r'::"char", 'a'::"char", false, false),
        ('customer_account_deletion_requests_account_id_fkey', 'public', 'customer_account_deletion_requests', 'account_id', 'id', 'r'::"char", 'a'::"char", false, false),
        ('customer_auth_identities_account_id_fkey', 'public', 'customer_auth_identities', 'account_id', 'id', 'r'::"char", 'a'::"char", false, false),
        ('customer_firebase_principals_account_id_fkey', 'public', 'customer_firebase_principals', 'account_id', 'id', 'r'::"char", 'a'::"char", false, false),
        ('customer_firebase_principals_merged_into_account_id_fkey', 'public', 'customer_firebase_principals', 'merged_into_account_id', 'id', 'r'::"char", 'a'::"char", false, false),
        ('orders_account_id_fkey', 'public', 'orders', 'account_id', 'id', 'r'::"char", 'a'::"char", false, false),
        ('profiles_account_id_fkey', 'public', 'profiles', 'account_id', 'id', 'r'::"char", 'a'::"char", false, false)
    ), actual as (
      select constraint_name, child_schema, child_table, child_column, parent_column, confdeltype, confupdtype, condeferrable, condeferred
      from foundation_decision_a_fk_manifest
    )
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  ) then
    raise exception 'foundation Decision A foreign-key manifest differs from the approved Todo 2 inventory';
  end if;

  if exists (
    select 1
    from foundation_decision_a_fk_manifest
    where child_key_count <> 1
       or parent_key_count <> 1
       or parent_column is distinct from 'id'
       or child_column is null
  ) then
    raise exception 'foundation Decision A only supports single-column foreign keys to customer_accounts(id)';
  end if;

  if exists (
    select 1
    from public.customer_accounts account
    left join auth.users legacy_user on legacy_user.id = account.legacy_supabase_user_id
    where account.legacy_supabase_user_id is not null
      and legacy_user.id is null
  ) then
    raise exception 'foundation Decision A found a legacy mapping without an auth.users row';
  end if;

  if exists (
    select legacy_supabase_user_id
    from public.customer_accounts
    where legacy_supabase_user_id is not null
    group by legacy_supabase_user_id
    having count(*) > 1
  ) then
    raise exception 'foundation Decision A found duplicate legacy account mappings';
  end if;

  if exists (
    select 1
    from public.customer_accounts source_account
    join public.customer_accounts occupied_account
      on occupied_account.id = source_account.legacy_supabase_user_id
     and occupied_account.id <> source_account.id
    where source_account.legacy_supabase_user_id is not null
      and source_account.id <> source_account.legacy_supabase_user_id
  ) then
    raise exception 'foundation Decision A found an occupied legacy UUID target';
  end if;

  for reference_row in
    select *
    from foundation_decision_a_fk_manifest
  loop
    execute format(
      'select count(*) from %I.%I child left join public.customer_accounts account on account.id = child.%I where child.%I is not null and account.id is null',
      reference_row.child_schema,
      reference_row.child_table,
      reference_row.child_column,
      reference_row.child_column
    ) into orphan_count;

    if orphan_count <> 0 then
      raise exception 'foundation Decision A found % orphaned child references for %', orphan_count, reference_row.constraint_name;
    end if;
  end loop;
end;
$preflight$;

do $remap$
declare
  reference_row record;
begin
  for reference_row in
    select *
    from foundation_decision_a_fk_manifest
    order by child_schema, child_table, constraint_name
  loop
    execute format(
      'alter table %I.%I drop constraint %I',
      reference_row.child_schema,
      reference_row.child_table,
      reference_row.constraint_name
    );

    execute format(
      'alter table %I.%I add constraint %I foreign key (%I) references public.customer_accounts (%I) on delete %s on update cascade%s%s',
      reference_row.child_schema,
      reference_row.child_table,
      reference_row.constraint_name,
      reference_row.child_column,
      reference_row.parent_column,
      case reference_row.confdeltype
        when 'a' then 'no action'
        when 'r' then 'restrict'
        when 'c' then 'cascade'
        when 'n' then 'set null'
        when 'd' then 'set default'
      end,
      case when reference_row.condeferrable then ' deferrable' else ' not deferrable' end,
      case when reference_row.condeferrable and reference_row.condeferred then ' initially deferred' else '' end
    );
  end loop;

  update public.customer_accounts
  set id = legacy_supabase_user_id
  where legacy_supabase_user_id is not null
    and id <> legacy_supabase_user_id;

  for reference_row in
    select *
    from foundation_decision_a_fk_manifest
    order by child_schema, child_table, constraint_name
  loop
    execute format(
      'alter table %I.%I drop constraint %I',
      reference_row.child_schema,
      reference_row.child_table,
      reference_row.constraint_name
    );

    execute format(
      'alter table %I.%I add constraint %I %s',
      reference_row.child_schema,
      reference_row.child_table,
      reference_row.constraint_name,
      reference_row.constraint_definition
    );
  end loop;
end;
$remap$;

create or replace function public.ensure_customer_account_for_legacy_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  insert into public.customer_accounts (id, legacy_supabase_user_id)
  values (new.id, new.id);
  return new;
end;
$function$;

drop trigger if exists ensure_customer_account_for_legacy_user on auth.users;
create trigger ensure_customer_account_for_legacy_user
after insert on auth.users
for each row execute function public.ensure_customer_account_for_legacy_user();

revoke execute on function public.ensure_customer_account_for_legacy_user() from public, anon, authenticated;

do $updated_at$
begin
  if to_regprocedure('public.touch_updated_at()') is not null then
    drop trigger if exists touch_customer_accounts_updated_at on public.customer_accounts;
    create trigger touch_customer_accounts_updated_at
    before update on public.customer_accounts
    for each row execute function public.touch_updated_at();

    drop trigger if exists touch_customer_firebase_principals_updated_at on public.customer_firebase_principals;
    create trigger touch_customer_firebase_principals_updated_at
    before update on public.customer_firebase_principals
    for each row execute function public.touch_updated_at();

    drop trigger if exists touch_customer_auth_identities_updated_at on public.customer_auth_identities;
    create trigger touch_customer_auth_identities_updated_at
    before update on public.customer_auth_identities
    for each row execute function public.touch_updated_at();
  end if;
end;
$updated_at$;

commit;
