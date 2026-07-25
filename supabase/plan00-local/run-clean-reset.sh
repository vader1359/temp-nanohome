#!/bin/sh
set -eu

usage() {
  printf '%s\n' 'Usage: supabase/plan00-local/run-clean-reset.sh --target foundation|instagram|--full' >&2
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
  if ! "$docker_bin" image inspect "$pg_prove_image" >/dev/null 2>&1; then
    printf 'Local pg_prove image is unavailable: %s. This local-only harness will not pull images.\n' "$pg_prove_image" >&2
    return 1
  fi

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

  if [ -z "$db_container" ]; then
    printf 'Temporary local database container for project %s could not be verified from Docker labels. Check local Docker state and Supabase CLI labels.\n' "$stack_project" >&2
    return 1
  fi

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

trap cleanup 0
trap 'exit 129' 1
trap 'exit 130' 2
trap 'exit 143' 15

mkdir -p "$harness_dir/supabase/migrations" "$harness_dir/tests"
cp "$repo_root/supabase/config.toml" "$harness_dir/supabase/config.toml"
sed -i "s/^project_id = .*/project_id = \"$stack_project\"/" "$harness_dir/supabase/config.toml"
cp "$repo_root"/supabase/migrations/*.sql "$harness_dir/supabase/migrations/"
mv "$harness_dir/supabase/migrations/20260710000003_add_korean_read_columns.sql" \
  "$harness_dir/supabase/migrations/20260710000006_add_korean_read_columns.sql"
mv "$harness_dir/supabase/migrations/20260711000000_use_strict_amis_inventory_cutoff.sql" \
  "$harness_dir/supabase/migrations/20260711000004_use_strict_amis_inventory_cutoff.sql"
cp "$repo_root/supabase/plan00-local/00000000000000_catalog_baseline.sql" \
  "$harness_dir/supabase/migrations/00000000000000_catalog_baseline.sql"
cp "$repo_root/supabase/seed.sql" "$harness_dir/tests/seed.sql"
cp "$repo_root/supabase/tests/fixtures.sql" "$harness_dir/tests/fixtures.sql"

test_manifest="$harness_parent/test-manifest"
find "$repo_root/supabase/tests" -type f -name '*.sql' ! -name 'fixtures.sql' | LC_ALL=C sort >"$test_manifest"
while IFS= read -r source_test; do
  copy_test "$source_test"
done <"$test_manifest"

pre_start_containers=$("$docker_bin" ps -aq)
"$supabase_bin" start --workdir "$harness_dir" >/dev/null 2>&1
stack_started=1
"$supabase_bin" db reset --local --no-seed --yes --workdir "$harness_dir" >/dev/null 2>&1
"$supabase_bin" db lint --local --workdir "$harness_dir" >/dev/null 2>&1
cp -R "$harness_dir/supabase/migrations" "$harness_dir/migrations"
if [ "$mode" != instagram ]; then
  set -- "$supabase_bin" test db --local --workdir "$harness_dir"
  while IFS= read -r source_test; do
    if [ "$mode" = full ] || is_foundation_test "$source_test"; then
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
