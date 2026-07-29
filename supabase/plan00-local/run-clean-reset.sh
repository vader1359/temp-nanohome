#!/bin/sh
set -eu

usage() {
  printf '%s\n' 'Usage: supabase/plan00-local/run-clean-reset.sh --target foundation|foundation-decision-a|instagram|--full' >&2
}

mode=
case "$#" in
  1)
    case "$1" in
      --full) mode=full ;;
      *) usage; exit 2 ;;
    esac
    ;;
  2)
    case "$1:$2" in
       --target:foundation) mode=foundation ;;
       --target:foundation-decision-a) mode=foundation-decision-a ;;
      --target:instagram) mode=instagram ;;
      *) usage; exit 2 ;;
    esac
    ;;
  *) usage; exit 2 ;;
esac

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
supabase_bin=${SUPABASE_BIN:-"$HOME/.supabase/bin/supabase"}
docker_bin=${DOCKER_BIN:-docker}
pg_prove_image=${PG_PROVE_IMAGE:-public.ecr.aws/supabase/pg_prove:3.36}
harness_parent=$(mktemp -d "${TMPDIR:-/tmp}/nanohome-plan00.XXXXXX")
harness_dir="$harness_parent/$(basename "$harness_parent")"
stack_project=$(basename "$harness_dir")
pre_start_containers=
stack_started=0

cleanup() {
  status=$?

  if [ "$stack_started" -eq 1 ]; then
    "$supabase_bin" stop --no-backup --workdir "$harness_dir" >/dev/null 2>&1 || :
  fi

  rm -rf "$harness_parent"
  exit "$status"
}

copy_test() {
  source_test=$1
  relative_test=${source_test#"$repo_root/supabase/tests/"}
  target_test="$harness_dir/tests/$relative_test"
  mkdir -p "$(dirname "$target_test")"
  sed 's|^\\ir \.\./seed\.sql$|\\ir seed.sql|' "$source_test" >"$target_test"
}

is_foundation_test() {
  case "$(basename "$1")" in
    foundation_*_test.sql|customer_data_foundation_test.sql) return 0 ;;
    *) return 1 ;;
  esac
}

run_instagram_test() {
  find_database_container

  "$docker_bin" run --rm \
    --network "container:$db_container" \
    -v "$harness_dir:$harness_dir:ro" \
    -w "$harness_dir/tests" \
    -e PGHOST=127.0.0.1 \
    -e PGPORT=5432 \
    -e PGUSER=postgres \
    -e PGPASSWORD=postgres \
    -e PGDATABASE=postgres \
    "$pg_prove_image" sh -ceu 'psql -v ON_ERROR_STOP=1 -c "create extension if not exists pgtap"; exec pg_prove "$1"' \
    sh "$harness_dir/tests/instagram_cleanup_test.sql"
}

find_database_container() {
  if [ -n "${db_container:-}" ]; then
    return 0
  fi

  if ! "$docker_bin" image inspect "$pg_prove_image" >/dev/null 2>&1; then
    printf 'Local pg_prove image is unavailable: %s. This local-only harness will not pull images.\n' "$pg_prove_image" >&2
    return 1
  fi

  attempt=0
  while [ "$attempt" -lt 30 ]; do
    db_containers=$("$docker_bin" ps -q)
    db_container=
    for container in $db_containers; do
      case " $pre_start_containers " in
        *" $container "*) continue ;;
      esac
      labels=$("$docker_bin" inspect -f '{{index .Config.Labels "com.supabase.cli.project"}} {{index .Config.Labels "com.docker.compose.project"}} {{.Name}} {{.Config.Image}} {{.State.Running}}' "$container")
      case "$labels" in
        "$stack_project $stack_project /supabase_db_$stack_project "*'supabase/postgres'*' true')
        if [ -n "$db_container" ]; then
          printf '%s\n' 'Temporary local stack has more than one verified database container.' >&2
          return 1
        fi
        db_container=$container
        ;;
      esac
    done

    if [ -n "$db_container" ]; then
      return 0
    fi

    attempt=$((attempt + 1))
    sleep 1
  done

  printf 'Temporary local database container for project %s could not be verified from Docker labels. Check local Docker state and Supabase CLI labels.\n' "$stack_project" >&2
  return 1
}

run_decision_a_preflight_replay() {
  for scenario in collision missing-auth duplicate-legacy orphan-child manifest-drift success; do
    find_database_container
    "$docker_bin" run --rm \
      --network "container:$db_container" \
      -v "$harness_dir:$harness_dir:ro" \
      -w "$harness_dir/tests" \
      -e PGHOST=127.0.0.1 \
      -e PGPORT=5432 \
      -e PGUSER=postgres \
      -e PGPASSWORD=postgres \
      -e PGDATABASE=postgres \
      "$pg_prove_image" sh "$harness_dir/tests/foundation_decision_a_preflight_replay.sh" \
      "$harness_dir/decision_a_migration.sql" \
      "$harness_dir/tests/foundation_decision_a_preflight_setup.psql" \
      "$scenario"

    "$supabase_bin" db reset --local --no-seed --yes --workdir "$harness_dir" >/dev/null 2>&1
    db_container=
  done
}

trap cleanup 0
trap 'exit 129' 1
trap 'exit 130' 2
trap 'exit 143' 15

mkdir -p "$harness_dir/supabase/migrations" "$harness_dir/tests"
cp "$repo_root/supabase/config.toml" "$harness_dir/supabase/config.toml"
config_tmp="$harness_dir/supabase/config.toml.tmp"
sed "s/^project_id = .*/project_id = \"$stack_project\"/" \
  "$harness_dir/supabase/config.toml" >"$config_tmp"
mv "$config_tmp" "$harness_dir/supabase/config.toml"
cp "$repo_root"/supabase/migrations/*.sql "$harness_dir/supabase/migrations/"
cp "$repo_root/supabase/plan00-local/00000000000000_catalog_baseline.sql" \
  "$harness_dir/supabase/migrations/00000000000000_catalog_baseline.sql"
cp "$repo_root/supabase/seed.sql" "$harness_dir/tests/seed.sql"
cp "$repo_root/supabase/tests/fixtures.sql" "$harness_dir/tests/fixtures.sql"
cp "$repo_root/supabase/tests/foundation_decision_a_preflight_replay.sh" \
  "$harness_dir/tests/foundation_decision_a_preflight_replay.sh"
cp "$repo_root/supabase/tests/foundation_decision_a_preflight_setup.psql" \
  "$harness_dir/tests/foundation_decision_a_preflight_setup.psql"

if [ "$mode" = foundation-decision-a ]; then
  mv "$harness_dir/supabase/migrations/20260726000000_foundation_decision_a_identity_fix.sql" \
    "$harness_dir/decision_a_migration.sql"
fi

test_manifest="$harness_parent/test-manifest"
find "$repo_root/supabase/tests" -type f -name '*.sql' \
  ! -name 'fixtures.sql' | LC_ALL=C sort >"$test_manifest"
while IFS= read -r source_test; do
  copy_test "$source_test"
done <"$test_manifest"

pre_start_containers=$("$docker_bin" ps -aq)
if "$supabase_bin" start --workdir "$harness_dir" >/dev/null; then
  :
else
  status=$?
  printf '%s\n' 'Local Supabase start failed.' >&2
  exit "$status"
fi
stack_started=1
"$supabase_bin" db reset --local --no-seed --yes --workdir "$harness_dir" >/dev/null 2>&1
if [ "$mode" = foundation-decision-a ]; then
  run_decision_a_preflight_replay
  mv "$harness_dir/decision_a_migration.sql" \
    "$harness_dir/supabase/migrations/20260726000000_foundation_decision_a_identity_fix.sql"
  "$supabase_bin" db reset --local --no-seed --yes --workdir "$harness_dir" >/dev/null 2>&1
fi
"$supabase_bin" db lint --local --workdir "$harness_dir" >/dev/null 2>&1
cp -R "$harness_dir/supabase/migrations" "$harness_dir/migrations"
if [ "$mode" != instagram ]; then
  set -- "$supabase_bin" test db --local --workdir "$harness_dir"
  while IFS= read -r source_test; do
    if [ "$mode" = full ] \
      || { [ "$mode" = foundation ] && is_foundation_test "$source_test"; } \
      || { [ "$mode" = foundation-decision-a ] && [ "$(basename "$source_test")" = foundation_decision_a_identity_test.sql ]; }; then
      relative_test=${source_test#"$repo_root/supabase/tests/"}
      if [ "$relative_test" != instagram_cleanup_test.sql ]; then
        set -- "$@" "$harness_dir/tests/$relative_test"
      fi
    fi
  done <"$test_manifest"

  if [ "$#" -eq 6 ]; then
    printf '%s\n' 'No tests selected.' >&2
    exit 1
  fi

  "$@"
fi

if [ "$mode" = full ] || [ "$mode" = instagram ]; then
  run_instagram_test
fi
