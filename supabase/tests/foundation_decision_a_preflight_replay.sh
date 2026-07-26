#!/bin/sh
set -eu

migration_file=$1
setup_file=$2
scenario=$3

run_psql() {
  psql -v ON_ERROR_STOP=1 "$@"
}

assert_query() {
  query=$1
  description=$2
  result=$(run_psql -At -c "$query")
  if [ "$result" != t ]; then
    printf '%s\n' "Decision A preflight replay failed: $description" >&2
    return 1
  fi
}

run_psql -v scenario="$scenario" -f "$setup_file" >/dev/null

if [ "$scenario" = success ]; then
  run_psql -f "$migration_file" >/dev/null
  assert_query "
    select exists (
      select 1
      from public.decision_a_preflight_state state
      join public.customer_accounts account
        on account.id = state.target_id
       and account.legacy_supabase_user_id = state.target_id
      join public.customer_firebase_principals principal
        on principal.account_id = state.target_id
       and principal.firebase_uid = 'decision-a-preflight-success'
      where state.scenario = 'success'
    )" 'temporary ON UPDATE CASCADE remaps the referenced child with the parent'

  assert_query "
    select count(*) = 8
    from pg_constraint constraint_row
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.customer_accounts'::regclass
      and constraint_row.confdeltype = 'r'
      and constraint_row.confupdtype = 'a'
      and not constraint_row.condeferrable
      and not constraint_row.condeferred" 'restored foreign keys retain approved delete, update, and deferrability semantics'
else
  if run_psql -f "$migration_file" >/dev/null 2>&1; then
    printf '%s\n' "Decision A preflight replay unexpectedly succeeded: $scenario" >&2
    exit 1
  fi

  assert_query "
    select exists (
      select 1
      from public.decision_a_preflight_state state
      join public.customer_accounts account
        on account.id = state.source_id
       and account.legacy_supabase_user_id = state.target_id
      where state.scenario = '$scenario'
    ) and exists (
      select 1
      from public.decision_a_preflight_state state
      join public.customer_firebase_principals principal
        on principal.account_id = state.source_id
       and principal.firebase_uid = 'decision-a-preflight-$scenario'
      where state.scenario = '$scenario'
    )" "$scenario aborts before the parent or child remap"

  case "$scenario" in
    collision)
      assert_query "
        select exists (
          select 1
          from public.decision_a_preflight_state state
          join public.customer_accounts occupied on occupied.id = state.target_id
          where state.scenario = 'collision'
        ) and (
          select count(*) from public.customer_accounts
          where legacy_supabase_user_id = '00000000-0000-4000-8000-0000000000b2'::uuid
        ) = 1" 'collision fixture remains intact after rollback'
      ;;
    missing-auth)
      assert_query "
        select not exists (
          select 1 from auth.users
          where id = '00000000-0000-4000-8000-0000000000b3'::uuid
        )" 'missing auth fixture remains missing after rollback'
      ;;
    duplicate-legacy)
      assert_query "
        select (
          select count(*) from public.customer_accounts
          where legacy_supabase_user_id = '00000000-0000-4000-8000-0000000000b1'::uuid
        ) = 2" 'duplicate legacy fixture remains intact after rollback'
      ;;
    orphan-child)
      assert_query "
        select exists (
          select 1 from public.customer_firebase_principals
          where firebase_uid = 'decision-a-preflight-orphan'
            and account_id = '00000000-0000-4000-8000-0000000000b4'::uuid
        )" 'orphan child fixture remains intact after rollback'
      ;;
    manifest-drift)
      assert_query "
        select exists (
          select 1 from pg_constraint
          where conname = 'decision_a_manifest_drift_account_id_fkey'
        )" 'unexpected foreign key remains intact after rollback'
      ;;
  esac
fi

printf '%s\n' "Decision A preflight replay: PASS ($scenario)"
