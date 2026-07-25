#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
test_parent=$(mktemp -d "${TMPDIR:-/tmp}/nanohome-plan00-test.XXXXXX")
fake_bin="$test_parent/supabase"
fake_docker="$test_parent/docker"
log="$test_parent/log"
source_status_before=$(git -C "$repo_root" status --porcelain -- supabase/migrations supabase/seed.sql)
instagram_source_before=$(cksum "$repo_root/supabase/tests/instagram_cleanup_test.sql")

cleanup() {
  status=$?
  rm -rf "$test_parent"
  trap - 0
  exit "$status"
}

trap cleanup 0 1 2 15

cat >"$fake_bin" <<'EOF'
#!/bin/sh
set -eu
printf '%s\n' "$*" >>"$HARNESS_LOG"
case "$1" in
  start)
    workdir=
    shift
    while [ "$#" -gt 0 ]; do
      if [ "$1" = --workdir ]; then
        workdir=$2
        break
      fi
      shift
    done
    sed -n 's/^project_id = "\(.*\)"/\1/p' "$workdir/supabase/config.toml" >"${HARNESS_LOG}.project"
    printf '%s\n' "$workdir" >"${HARNESS_LOG}.workdir"
    if [ "${FAKE_START_WAIT:-0}" = 1 ]; then
      while :; do sleep 1; done
    fi
    exit 0
    ;;
  stop)
    exit "${FAKE_STOP_EXIT:-0}"
    ;;
  db)
    case "$2" in
      reset)
        workdir=
        shift 2
        while [ "$#" -gt 0 ]; do
          if [ "$1" = --workdir ]; then
            workdir=$2
            break
          fi
          shift
        done
        test -f "$workdir/supabase/migrations/00000000000000_catalog_baseline.sql"
        test -f "$workdir/supabase/migrations/20260710000006_add_korean_read_columns.sql"
        test ! -e "$workdir/supabase/migrations/20260710000003_add_korean_read_columns.sql"
        test -f "$workdir/supabase/migrations/20260711000004_use_strict_amis_inventory_cutoff.sql"
        test ! -e "$workdir/supabase/migrations/20260711000000_use_strict_amis_inventory_cutoff.sql"
        exit 0
        ;;
      lint) exit 0 ;;
    esac
    ;;
  test)
    workdir=
    shift 2
    while [ "$#" -gt 0 ]; do
      if [ "$1" = --workdir ]; then
        workdir=$2
        break
      fi
      shift
    done
    instagram_test="$workdir/tests/instagram_cleanup_test.sql"
    test -f "$workdir/tests/seed.sql"
    test -f "$workdir/migrations/20260712010000_enforce_instagram_snapshot_composition.sql"
    test -f "$instagram_test"
    test "$(grep -Fxc '\ir ../migrations/20260712010000_enforce_instagram_snapshot_composition.sql' "$instagram_test")" -eq 2
    test -f "$(dirname "$instagram_test")/../migrations/20260712010000_enforce_instagram_snapshot_composition.sql"
    case " $* " in
      *" $instagram_test "*|*" 20260712010000_enforce_instagram_snapshot_composition.sql "*) exit 65 ;;
    esac
    grep -F '\ir seed.sql' "$workdir/tests/catalog_eligibility_test.sql" >/dev/null
    if [ "${FAKE_TEST_WAIT:-0}" = 1 ]; then
      while :; do sleep 1; done
    fi
    exit "${FAKE_TEST_EXIT:-0}"
    ;;
esac
exit 64
EOF
chmod +x "$fake_bin"

cat >"$fake_docker" <<'EOF'
#!/bin/sh
set -eu
printf 'docker %s\n' "$*" >>"$HARNESS_LOG"
case "$1:$2" in
  image:inspect)
    test "${FAKE_IMAGE_MISSING:-0}" != 1
    exit 0
    ;;
  ps:-q)
    printf '%s\n' "${FAKE_RUNNING_CONTAINERS:-fake-db}"
    exit 0
    ;;
  ps:-aq)
    printf '%s\n' "${FAKE_PRE_START_CONTAINERS:-existing-db}"
    exit 0
    ;;
  inspect:-f)
    project=$(cat "${HARNESS_LOG}.project")
    case "$4" in
      fake-db)
        printf '%s %s /supabase_db_%s public.ecr.aws/supabase/postgres:17.6.1.147 true\n' "$project" "$project" "$project"
        ;;
      foreign-db)
        printf '%s %s /supabase_db_foreign-project public.ecr.aws/supabase/postgres:17.6.1.147 true\n' foreign-project foreign-project
        ;;
      wrong-service-db)
        printf '%s %s /supabase_rest_%s public.ecr.aws/supabase/postgres:17.6.1.147 true\n' "$project" "$project" "$project"
        ;;
      existing-db)
        printf '%s %s /supabase_db_%s public.ecr.aws/supabase/postgres:17.6.1.147 true\n' "$project" "$project" "$project"
        ;;
      *) exit 68 ;;
    esac
    exit 0
    ;;
  run:--rm)
    case " $* " in
      *' -r '*|*' 20260712010000_enforce_instagram_snapshot_composition.sql '*) exit 66 ;;
      *instagram_cleanup_test.sql*) ;;
      *) exit 67 ;;
    esac
    case " $* " in
      *'create extension if not exists pgtap'*) ;;
      *) exit 69 ;;
    esac
    exit "${FAKE_DOCKER_RUN_EXIT:-0}"
    ;;
esac
exit 64
EOF
chmod +x "$fake_docker"

HARNESS_LOG="$log" SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" "$repo_root/supabase/plan00-local/run-clean-reset.sh" --full

for command in 'start --workdir' 'db reset --local --no-seed --yes --workdir' 'db lint --local --workdir' 'test db --local --workdir' 'stop --no-backup --workdir'; do
  if ! grep -F "$command" "$log" >/dev/null; then
    printf 'missing baseline command: %s\n' "$command" >&2
    exit 1
  fi
done

: >"$log"
HARNESS_LOG="$log" SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" "$repo_root/supabase/plan00-local/run-clean-reset.sh" --target foundation
foundation_test=$(grep '^test db ' "$log")
case "$foundation_test" in
  *foundation_identity_accounts_test.sql*foundation_legacy_account_ownership_test.sql*)
    ;;
  *)
    printf '%s\n' 'foundation target omitted a Foundation suite' >&2
    exit 1
    ;;
esac
case "$foundation_test" in
  *catalog_eligibility_test.sql*|*rls_test.sql*|*instagram_cleanup_test.sql*)
    printf '%s\n' 'foundation target is not isolated' >&2
    exit 1
    ;;
esac

: >"$log"
HARNESS_LOG="$log" SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" "$repo_root/supabase/plan00-local/run-clean-reset.sh" --full
full_test=$(grep '^test db ' "$log")
for suite in $(find "$repo_root/supabase/tests" -type f -name '*.sql' | LC_ALL=C sort); do
  case "$(basename "$suite")" in
    fixtures.sql) continue ;;
  esac
  if ! printf '%s\n' "$full_test" | grep -F "$(basename "$suite")" >/dev/null; then
    if [ "$(basename "$suite")" = instagram_cleanup_test.sql ]; then
      continue
    fi
    printf 'full target omitted: %s\n' "$suite" >&2
    exit 1
  fi
done
case "$full_test" in
  *instagram_cleanup_test.sql*|*20260712010000_enforce_instagram_snapshot_composition.sql*)
    printf '%s\n' 'normal CLI suite included Instagram or a migration operand' >&2
    exit 1
    ;;
esac
docker_run=$(grep '^docker run ' "$log")
for required in \
  '-v /tmp/nanohome-plan00.' \
  ':ro' \
  '-w ' \
  '/tests' \
  '--network container:fake-db' \
  '-e PGHOST=127.0.0.1' \
  '-e PGPORT=5432' \
  'instagram_cleanup_test.sql'; do
  if ! printf '%s\n' "$docker_run" | grep -F -- "$required" >/dev/null; then
    printf 'Instagram runner is missing required Docker argument: %s\n' "$required" >&2
    exit 1
  fi
done
case "$docker_run" in
  *' -r '*|*20260712010000_enforce_instagram_snapshot_composition.sql*)
    printf '%s\n' 'Instagram runner passed an unsafe pg_prove operand' >&2
    exit 1
    ;;
esac

: >"$log"
HARNESS_LOG="$log" SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" "$repo_root/supabase/plan00-local/run-clean-reset.sh" --target instagram
if grep '^test db ' "$log" >/dev/null; then
  printf '%s\n' 'Instagram-only target invoked the normal CLI suites' >&2
  exit 1
fi
if ! grep '^docker run ' "$log" | grep -F 'instagram_cleanup_test.sql' >/dev/null; then
  printf '%s\n' 'Instagram-only target did not invoke the direct runner' >&2
  exit 1
fi

: >"$log"
HARNESS_LOG="$log" SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" "$repo_root/supabase/plan00-local/run-clean-reset.sh" --full
if ! grep '^test db ' "$log" | grep -F 'tests/commerce/checkout_ledger_test.sql' >/dev/null; then
  printf '%s\n' 'full target did not discover a nested suite' >&2
  exit 1
fi

stale_workdir="$test_parent/nanohome-plan00.stale"
mkdir -p "$stale_workdir"
printf '%s\n' stale >"$stale_workdir/sentinel"
TMPDIR="$test_parent" HARNESS_LOG="$log" SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" \
  "$repo_root/supabase/plan00-local/run-clean-reset.sh" --target foundation
if ! test -f "$stale_workdir/sentinel"; then
  printf '%s\n' 'harness reused stale disposable state' >&2
  exit 1
fi

for args in '' '--target' '--target unknown' '--target foundation --full' '--full unexpected' '--linked' '--target --linked'; do
  set +e
  HARNESS_LOG="$log" SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" "$repo_root/supabase/plan00-local/run-clean-reset.sh" $args >/dev/null 2>&1
  status=$?
  set -e
  if [ "$status" -ne 2 ]; then
    printf 'malformed input did not exit 2: %s (got %s)\n' "$args" "$status" >&2
    exit 1
  fi
done

: >"$log"
set +e
HARNESS_LOG="$log" FAKE_STOP_EXIT=6 FAKE_TEST_EXIT=7 SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" \
  "$repo_root/supabase/plan00-local/run-clean-reset.sh" --full >/dev/null 2>&1
status=$?
set -e
if [ "$status" -ne 7 ]; then
  printf '%s\n' 'full target hid a pgTAP failure behind cleanup' >&2
  exit 1
fi
if grep '^docker run ' "$log" >/dev/null; then
  printf '%s\n' 'normal-suite failure did not gate the Instagram runner' >&2
  exit 1
fi

set +e
HARNESS_LOG="$log" FAKE_DOCKER_RUN_EXIT=8 SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" \
  "$repo_root/supabase/plan00-local/run-clean-reset.sh" --full >/dev/null 2>&1
status=$?
set -e
if [ "$status" -ne 8 ]; then
  printf '%s\n' 'Instagram runner failure did not propagate' >&2
  exit 1
fi

set +e
HARNESS_LOG="$log" FAKE_IMAGE_MISSING=1 SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" \
  "$repo_root/supabase/plan00-local/run-clean-reset.sh" --full >/dev/null 2>&1
status=$?
set -e
if [ "$status" -eq 0 ]; then
  printf '%s\n' 'missing local pg_prove image did not fail closed' >&2
  exit 1
fi

: >"$log"
set +e
HARNESS_LOG="$log" FAKE_RUNNING_CONTAINERS=foreign-db SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" \
  "$repo_root/supabase/plan00-local/run-clean-reset.sh" --target instagram >/dev/null 2>&1
status=$?
set -e
if [ "$status" -eq 0 ]; then
  printf '%s\n' 'foreign Supabase-labelled database container was accepted' >&2
  exit 1
fi
if grep '^docker run ' "$log" >/dev/null; then
  printf '%s\n' 'foreign database container reached the direct runner' >&2
  exit 1
fi

: >"$log"
set +e
HARNESS_LOG="$log" FAKE_RUNNING_CONTAINERS=wrong-service-db SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" \
  "$repo_root/supabase/plan00-local/run-clean-reset.sh" --target instagram >/dev/null 2>&1
status=$?
set -e
if [ "$status" -eq 0 ]; then
  printf '%s\n' 'non-database service container was accepted' >&2
  exit 1
fi

source_status_after=$(git -C "$repo_root" status --porcelain -- supabase/migrations supabase/seed.sql)
if [ "$source_status_before" != "$source_status_after" ]; then
  printf '%s\n' 'harness changed protected source files' >&2
  exit 1
fi
if [ "$instagram_source_before" != "$(cksum "$repo_root/supabase/tests/instagram_cleanup_test.sql")" ]; then
  printf '%s\n' 'harness changed the protected Instagram suite' >&2
  exit 1
fi

: >"$log"
setsid env HARNESS_LOG="$log" FAKE_TEST_WAIT=1 SUPABASE_BIN="$fake_bin" DOCKER_BIN="$fake_docker" \
  "$repo_root/supabase/plan00-local/run-clean-reset.sh" --full &
harness_pid=$!
while ! grep '^test db ' "$log" >/dev/null 2>&1; do
  sleep 1
done
start_line=$(grep '^start --workdir ' "$log")
set -- $start_line
harness_workdir=$3
kill -TERM "-$harness_pid"
if wait "$harness_pid"; then
  printf '%s\n' 'TERM did not interrupt the harness' >&2
  exit 1
fi
if ! grep '^stop --no-backup --workdir ' "$log" >/dev/null; then
  printf '%s\n' 'TERM did not stop the disposable stack' >&2
  exit 1
fi
if [ -e "$harness_workdir" ]; then
  printf '%s\n' 'TERM did not remove the disposable workdir' >&2
  exit 1
fi
