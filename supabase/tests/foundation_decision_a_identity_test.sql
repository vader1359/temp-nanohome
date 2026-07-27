begin;

\ir fixtures.sql

set local role postgres;

-- Given: a legacy user created through the production account trigger.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-0000000000a1',
  'authenticated',
  'authenticated',
  'decision-a-legacy@example.test',
  '',
  now()
);

create temporary table decision_a_fixture (
  label text primary key,
  id uuid not null,
  legacy_supabase_user_id uuid
) on commit drop;

insert into decision_a_fixture (label, id, legacy_supabase_user_id)
select 'legacy', id, legacy_supabase_user_id
from public.customer_accounts
where legacy_supabase_user_id = '00000000-0000-4000-8000-0000000000a1'::uuid;

-- Given: a Firebase-only account receives a generated account ID without a legacy user ID.
with inserted as (
  insert into public.customer_accounts (updated_at)
  values (transaction_timestamp() - interval '1 day')
  returning id, legacy_supabase_user_id
)
insert into decision_a_fixture (label, id, legacy_supabase_user_id)
select 'firebase', id, legacy_supabase_user_id
from inserted;

-- Given: a deliberately malformed legacy mapping and an occupied target ID model a remap collision.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-0000000000a4',
  'authenticated',
  'authenticated',
  'decision-a-collision@example.test',
  '',
  now()
);

update public.customer_accounts
set legacy_supabase_user_id = null
where id = '00000000-0000-4000-8000-0000000000a4'::uuid;

with inserted as (
  insert into public.customer_accounts (legacy_supabase_user_id)
  values ('00000000-0000-4000-8000-0000000000a4'::uuid)
  returning id, legacy_supabase_user_id
)
insert into decision_a_fixture (label, id, legacy_supabase_user_id)
select 'collision_migrated', id, legacy_supabase_user_id
from inserted;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-4000-8000-0000000000a3',
  'authenticated',
  'authenticated',
  'decision-a-future@example.test',
  '',
  now()
);

create temporary table decision_a_reference_counts (
  constraint_name text primary key,
  row_count bigint not null
) on commit drop;

create temporary view decision_a_account_references as
select constraint_row.conname,
       namespace_row.nspname,
       relation_row.relname,
       attribute_row.attname,
       constraint_row.confdeltype,
       pg_get_constraintdef(constraint_row.oid, true) as constraint_definition
from pg_constraint constraint_row
join pg_class relation_row on relation_row.oid = constraint_row.conrelid
join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
join unnest(constraint_row.conkey) with ordinality as child_key(attnum, position)
  on true
join unnest(constraint_row.confkey) with ordinality as parent_key(attnum, position)
  on parent_key.position = child_key.position
join pg_attribute attribute_row
  on attribute_row.attrelid = constraint_row.conrelid
 and attribute_row.attnum = child_key.attnum
join pg_attribute parent_attribute
  on parent_attribute.attrelid = constraint_row.confrelid
 and parent_attribute.attnum = parent_key.attnum
where constraint_row.contype = 'f'
  and constraint_row.confrelid = 'public.customer_accounts'::regclass
  and cardinality(constraint_row.conkey) = 1
  and cardinality(constraint_row.confkey) = 1
  and parent_attribute.attname = 'id';

do $snapshot$
declare
  reference record;
  referenced_rows bigint;
begin
  for reference in
    select * from decision_a_account_references
  loop
    execute format(
      'select count(*) from %I.%I where %I is not null',
      reference.nspname,
      reference.relname,
      reference.attname
    ) into referenced_rows;

    insert into decision_a_reference_counts (constraint_name, row_count)
    values (reference.conname, referenced_rows);
  end loop;
end;
$snapshot$;

select plan(19);

-- Then: the proof inventories every actual child FK that targets customer_accounts.id.
select is(
  (
    select count(*) from decision_a_account_references
  ),
  11::bigint,
  'all eleven current foreign keys to customer_accounts.id are inventoried'
);

select is(
  (
    select count(*)
    from decision_a_account_references
    where confdeltype = 'r'
      and constraint_definition like '%ON DELETE RESTRICT%'
  ),
  11::bigint,
  'the dynamic FK manifest preserves all current RESTRICT delete actions'
);

select is(
  (
    select string_agg(
      format('%I.%I.%I', nspname, relname, attname),
      ','
      order by nspname, relname, attname
    )
    from decision_a_account_references
  ),
  'public.account_policy_acceptances.account_id,public.carts.account_id,public.customer_account_deletion_requests.account_id,public.customer_amis_links.account_id,public.customer_auth_identities.account_id,public.customer_firebase_principals.account_id,public.customer_firebase_principals.merged_into_account_id,public.customer_identity_ledger.account_id,public.customer_memory_projections.account_id,public.orders.account_id,public.profiles.account_id',
  'the FK manifest covers principals, ledgers, AMIS memory, policy acceptance, deletion, carts, orders, and profiles'
);

select is(
  (
    select string_agg(conname, ',' order by conname)
    from decision_a_account_references
  ),
  'account_policy_acceptances_account_id_fkey,carts_account_id_fkey,customer_account_deletion_requests_account_id_fkey,customer_amis_links_account_id_fkey,customer_auth_identities_account_id_fkey,customer_firebase_principals_account_id_fkey,customer_firebase_principals_merged_into_account_id_fkey,customer_identity_ledger_account_id_fkey,customer_memory_projections_account_id_fkey,orders_account_id_fkey,profiles_account_id_fkey',
  'the dynamic FK manifest preserves every current constraint name'
);

select lives_ok(
  $proof$
    do $orphans$
    declare
      reference record;
      orphan_count bigint;
    begin
      for reference in
        select * from decision_a_account_references
      loop
        execute format(
          'select count(*) from %I.%I child left join public.customer_accounts account on account.id = child.%I where child.%I is not null and account.id is null',
          reference.nspname,
          reference.relname,
          reference.attname,
          reference.attname
        ) into orphan_count;

        if orphan_count <> 0 then
          raise exception 'orphaned customer account reference in %', reference.conname;
        end if;
      end loop;
    end;
  $orphans$;
  $proof$,
  'every inventoried customer account FK has no orphaned child rows'
);

select is(
  (select legacy_supabase_user_id from decision_a_fixture where label = 'firebase'),
  null::uuid,
  'Firebase-only account has no legacy Supabase user ID'
);

select ok(
  (select id from decision_a_fixture where label = 'firebase')
    <> (select legacy_supabase_user_id from decision_a_fixture where label = 'legacy'),
  'Firebase-only account retains a distinct generated account ID'
);

-- When: Decision A evaluates the production-triggered legacy account.
-- Then: the trigger and migrated accounts use the legacy auth UUID as the account ID.
select is(
  (select id from decision_a_fixture where label = 'legacy'),
  (select legacy_supabase_user_id from decision_a_fixture where label = 'legacy'),
  'Decision A: migrated legacy account ID equals auth.users.id'
);

select is(
  (
    select count(*)
    from public.customer_accounts
    where legacy_supabase_user_id is not null
      and id <> legacy_supabase_user_id
  ),
  1::bigint,
  'only the deliberate collision fixture remains mismatched after the migration'
);

select is(
  (
    select count(*)
    from public.customer_accounts
    where legacy_supabase_user_id = '00000000-0000-4000-8000-0000000000a1'::uuid
      and id <> legacy_supabase_user_id
  ),
  0::bigint,
  'natural migrated legacy accounts have no UUID mismatch'
);

select is(
  (
    select id
    from public.customer_accounts
    where legacy_supabase_user_id = '00000000-0000-4000-8000-0000000000a3'::uuid
  ),
  '00000000-0000-4000-8000-0000000000a3'::uuid,
  'future auth-trigger account uses the auth UUID as its account ID'
);

select is(
  (
    select legacy_supabase_user_id
    from public.customer_accounts
    where id = '00000000-0000-4000-8000-0000000000a3'::uuid
  ),
  '00000000-0000-4000-8000-0000000000a3'::uuid,
  'future auth-trigger account stores the matching legacy auth UUID'
);

-- When: malformed and duplicate legacy mappings are proposed.
-- Then: constraints reject them before any remap is attempted.
select throws_ok(
  $$insert into public.customer_accounts (legacy_supabase_user_id) values ('00000000-0000-4000-8000-0000000000ff'::uuid)$$,
  '23503',
  null,
  'orphan legacy mapping is rejected'
);

select throws_ok(
  $$insert into public.customer_accounts (legacy_supabase_user_id) values ('00000000-0000-4000-8000-0000000000a1'::uuid)$$,
  '23505',
  null,
  'duplicate legacy mapping is rejected'
);

select is(
  (
    select count(*)
    from public.customer_accounts account
    join decision_a_fixture fixture on fixture.label = 'collision_migrated'
      and fixture.legacy_supabase_user_id = account.legacy_supabase_user_id
    where exists (
      select 1
      from public.customer_accounts occupied
      where occupied.id = account.legacy_supabase_user_id
        and occupied.id <> account.id
    )
  ),
  1::bigint,
  'collision fixture occupies a legacy target ID before remap'
);

-- When: a raw remap meets the occupied collision target.
-- Then: PostgreSQL rejects the statement atomically and leaves the preflight state intact.
select throws_ok(
  $$update public.customer_accounts set id = legacy_supabase_user_id where legacy_supabase_user_id = '00000000-0000-4000-8000-0000000000a4'::uuid$$,
  '23505',
  null,
  'collision target rejects a remap atomically'
);

select is(
  (select id from public.customer_accounts where legacy_supabase_user_id = '00000000-0000-4000-8000-0000000000a4'::uuid),
  (select id from decision_a_fixture where label = 'collision_migrated'),
  'failed collision remap leaves the migrated account ID unchanged'
);

select lives_ok(
  $proof$
    do $counts$
    declare
      snapshot record;
      reference record;
      current_count bigint;
    begin
      for snapshot in select * from decision_a_reference_counts loop
        select nspname, relname, attname
        into reference
        from decision_a_account_references
        where conname = snapshot.constraint_name;

        execute format(
          'select count(*) from %I.%I where %I is not null',
          reference.nspname,
          reference.relname,
          reference.attname
        ) into current_count;

        if current_count <> snapshot.row_count then
          raise exception 'child-reference row count changed for %', snapshot.constraint_name;
        end if;
      end loop;
    end;
  $counts$;
  $proof$,
  'failed probes preserve every inventoried child-reference row count'
);

select lives_ok(
  $proof$
    do $updated_at$
    declare
      touched_updated_at timestamptz;
    begin
      update public.customer_accounts
      set state = state
      where id = (select id from decision_a_fixture where label = 'firebase');

      select updated_at
      into touched_updated_at
      from public.customer_accounts
      where id = (select id from decision_a_fixture where label = 'firebase');

      if touched_updated_at <> transaction_timestamp() then
        raise exception 'customer account updated_at was not maintained by a normal update';
      end if;
    end;
  $updated_at$;
  $proof$,
  'normal customer account updates maintain updated_at'
);

select * from finish();

rollback;
