#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
generator="$repo_root/supabase/plan00-local/generate-database-types.sh"
sandbox=$(mktemp -d "${TMPDIR:-/tmp}/nanohome-db-types-test.XXXXXX")
trap 'rm -rf "$sandbox"' 0

fail() {
  printf 'not ok - %s\n' "$1" >&2
  exit 1
}

assert_equal() {
  expected=$1
  actual=$2
  message=$3
  [ "$actual" = "$expected" ] || fail "$message (expected: $expected, actual: $actual)"
}

make_fixture() {
  fixture=$1
  mkdir -p "$fixture/repo/supabase/plan00-local" "$fixture/repo/supabase/migrations" "$fixture/repo/src/types" "$fixture/bin"
  cp "$repo_root/supabase/plan00-local/00000000000000_catalog_baseline.sql" "$fixture/repo/supabase/plan00-local/"
  cp "$repo_root/supabase/config.toml" "$fixture/repo/supabase/config.toml"
  printf '%s\n' '-- migration' >"$fixture/repo/supabase/migrations/20260710000003_add_korean_read_columns.sql"
  printf '%s\n' '-- migration' >"$fixture/repo/supabase/migrations/20260711000000_use_strict_amis_inventory_cutoff.sql"
  printf '%s\n' 'ORIGINAL_DESTINATION' >"$fixture/repo/src/types/database.types.ts"
  cp "$generator" "$fixture/repo/supabase/plan00-local/generate-database-types.sh"
  chmod +x "$fixture/repo/supabase/plan00-local/generate-database-types.sh"

  cat >"$fixture/bin/supabase" <<'FAKE'
#!/bin/sh
set -eu
printf '%s\n' "$*" >>"$FAKE_LOG"
case "$1:$2" in
  start:*) [ "${FAIL_PHASE:-}" != start ] ;;
  db:reset) [ "${FAIL_PHASE:-}" != reset ] ;;
  gen:types)
    [ "${FAIL_PHASE:-}" != gen ]
    printf '%s\n' 'GENERATED_TYPES'
    ;;
  stop:*) ;;
  *) printf 'unexpected command: %s\n' "$*" >&2; exit 64 ;;
esac
FAKE
  chmod +x "$fixture/bin/supabase"
}

run_failure_case() {
  phase=$1
  fixture="$sandbox/$phase"
  make_fixture "$fixture"
  if FAKE_LOG="$fixture/commands.log" FAIL_PHASE="$phase" SUPABASE_BIN="$fixture/bin/supabase" \
    "$fixture/repo/supabase/plan00-local/generate-database-types.sh" >/dev/null 2>&1; then
    fail "$phase failure must propagate"
  fi
  assert_equal ORIGINAL_DESTINATION "$(cat "$fixture/repo/src/types/database.types.ts")" "$phase failure must preserve destination"
}

[ -x "$generator" ] || fail 'generator exists and is executable'

run_failure_case start
run_failure_case reset
run_failure_case gen

success_fixture="$sandbox/success"
make_fixture "$success_fixture"
FAKE_LOG="$success_fixture/commands.log" SUPABASE_BIN="$success_fixture/bin/supabase" \
  "$success_fixture/repo/supabase/plan00-local/generate-database-types.sh"
assert_equal GENERATED_TYPES "$(cat "$success_fixture/repo/src/types/database.types.ts")" 'successful generation replaces destination'

while IFS= read -r command; do
  case "$command" in
    start\ --workdir\ *|db\ reset\ --local\ --no-seed\ --yes\ --workdir\ *|gen\ types\ typescript\ --local\ --workdir\ *|stop\ --project-id\ *\ --no-backup) ;;
    *) fail "command is outside the local-only contract: $command" ;;
  esac
done <"$success_fixture/commands.log"

if grep -Eiq '(access[_-]?token|service[_-]?role|password|secret|linked)' "$success_fixture/commands.log"; then
  fail 'commands must not expose secrets or linked-project behavior'
fi

printf '%s\n' 'ok - local database type generator contract'
