#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
supabase_bin=${SUPABASE_BIN:-"$HOME/.supabase/bin/supabase"}
destination="$repo_root/src/types/database.types.ts"
harness_parent=$(mktemp -d "${TMPDIR:-/tmp}/nanohome-db-types.XXXXXX")
harness_dir="$harness_parent/$(basename "$harness_parent")"
stack_project=$(basename "$harness_dir")
stack_started=0

cleanup() {
  status=$?
  if [ "$stack_started" -eq 1 ]; then
    "$supabase_bin" stop --project-id "$stack_project" --no-backup >/dev/null 2>&1 || :
  fi
  rm -rf "$harness_parent"
  exit "$status"
}

configure_isolated_ports() {
  set -- $(printf '%s\n' "$stack_project" | cksum)
  port_base=$((20000 + ($1 % 30000)))
  port_base=$((port_base - (port_base % 20)))

  awk \
    -v api_port="$port_base" \
    -v shadow_port="$((port_base + 1))" \
    -v db_port="$((port_base + 2))" \
    -v studio_port="$((port_base + 3))" \
    -v smtp_ui_port="$((port_base + 4))" \
    -v smtp_port="$((port_base + 5))" \
    -v pop3_port="$((port_base + 6))" \
    -v analytics_port="$((port_base + 7))" \
    -v inspector_port="$((port_base + 8))" '
      /^\[/ { section = $0 }
      section == "[api]" && /^port[[:space:]]*=/ { print "port = " api_port; next }
      section == "[db]" && /^port[[:space:]]*=/ { print "port = " db_port; next }
      section == "[db]" && /^shadow_port[[:space:]]*=/ { print "shadow_port = " shadow_port; next }
      section == "[studio]" && /^port[[:space:]]*=/ { print "port = " studio_port; next }
      section == "[local_smtp]" && /^port[[:space:]]*=/ {
        print "port = " smtp_ui_port
        print "smtp_port = " smtp_port
        print "pop3_port = " pop3_port
        next
      }
      section == "[analytics]" && /^enabled[[:space:]]*=/ {
        print
        print "port = " analytics_port
        next
      }
      { print }
      END {
        print ""
        print "[edge_runtime]"
        print "inspector_port = " inspector_port
      }
    ' "$harness_dir/supabase/config.toml" >"$harness_dir/supabase/config.toml.isolated"
  mv "$harness_dir/supabase/config.toml.isolated" "$harness_dir/supabase/config.toml"
}

trap cleanup 0
trap 'exit 129' 1
trap 'exit 130' 2
trap 'exit 143' 15

mkdir -p "$harness_dir/supabase/migrations"
cp "$repo_root/supabase/config.toml" "$harness_dir/supabase/config.toml"
sed -i "s/^project_id = .*/project_id = \"$stack_project\"/" "$harness_dir/supabase/config.toml"
configure_isolated_ports
cp "$repo_root"/supabase/migrations/*.sql "$harness_dir/supabase/migrations/"
mv "$harness_dir/supabase/migrations/20260710000003_add_korean_read_columns.sql" \
  "$harness_dir/supabase/migrations/20260710000006_add_korean_read_columns.sql"
mv "$harness_dir/supabase/migrations/20260711000000_use_strict_amis_inventory_cutoff.sql" \
  "$harness_dir/supabase/migrations/20260711000004_use_strict_amis_inventory_cutoff.sql"
cp "$repo_root/supabase/plan00-local/00000000000000_catalog_baseline.sql" \
  "$harness_dir/supabase/migrations/00000000000000_catalog_baseline.sql"

"$supabase_bin" start --workdir "$harness_dir" >/dev/null
stack_started=1
"$supabase_bin" db reset --local --no-seed --yes --workdir "$harness_dir" >/dev/null
"$supabase_bin" gen types typescript --local --workdir "$harness_dir" >"$harness_parent/database.types.ts"
mv "$harness_parent/database.types.ts" "$destination"
