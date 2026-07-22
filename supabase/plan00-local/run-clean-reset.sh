#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
supabase_bin=${SUPABASE_BIN:-"$HOME/.supabase/bin/supabase"}
harness_parent=$(mktemp -d "${TMPDIR:-/tmp}/nanohome-plan00.XXXXXX")
harness_dir="$harness_parent/nanohome-ecommerce"
trap 'rm -rf "$harness_parent"' EXIT INT TERM

mkdir -p "$harness_dir/migrations" "$harness_dir/tests/commerce"
cp "$repo_root/supabase/config.toml" "$harness_dir/config.toml"
cp "$repo_root"/supabase/migrations/*.sql "$harness_dir/migrations/"
cp "$repo_root/supabase/plan00-local/00000000000000_catalog_baseline.sql" \
  "$harness_dir/migrations/00000000000000_catalog_baseline.sql"
cp "$repo_root/supabase/seed.sql" "$harness_dir/seed.sql"
cp "$repo_root/supabase/tests/fixtures.sql" "$harness_dir/tests/fixtures.sql"
cp "$repo_root/supabase/tests/catalog_eligibility_test.sql" \
  "$harness_dir/tests/catalog_eligibility_test.sql"
cp "$repo_root/supabase/tests/customer_data_foundation_test.sql" \
  "$harness_dir/tests/customer_data_foundation_test.sql"
cp "$repo_root/supabase/tests/commerce/checkout_ledger_test.sql" \
  "$harness_dir/tests/commerce/checkout_ledger_test.sql"
cp "$repo_root/supabase/tests/amis_customer_memory_test.sql" \
  "$harness_dir/tests/amis_customer_memory_test.sql"
cp "$repo_root/supabase/tests/plan04_grounded_chat_test.sql" \
  "$harness_dir/tests/plan04_grounded_chat_test.sql"
cp "$repo_root/supabase/tests/vision_persistence_test.sql" \
  "$harness_dir/tests/vision_persistence_test.sql"
cp "$repo_root/supabase/tests/plan07_customer_personalization_test.sql" \
  "$harness_dir/tests/plan07_customer_personalization_test.sql"
cp "$repo_root/supabase/tests/customer_event_personalization_pipeline_test.sql" \
  "$harness_dir/tests/customer_event_personalization_pipeline_test.sql"

if [ "$#" -ne 0 ]; then
  printf '%s\n' 'This local-only harness takes no arguments.' >&2
  exit 2
fi

"$supabase_bin" db reset --local --no-seed --yes --workdir "$harness_dir"
"$supabase_bin" db lint --local --workdir "$harness_dir"
"$supabase_bin" test db --local --workdir "$harness_dir" \
  "$harness_dir/tests/catalog_eligibility_test.sql" \
  "$harness_dir/tests/customer_data_foundation_test.sql" \
  "$harness_dir/tests/commerce/checkout_ledger_test.sql" \
  "$harness_dir/tests/amis_customer_memory_test.sql" \
  "$harness_dir/tests/plan04_grounded_chat_test.sql" \
  "$harness_dir/tests/vision_persistence_test.sql" \
  "$harness_dir/tests/plan07_customer_personalization_test.sql" \
  "$harness_dir/tests/customer_event_personalization_pipeline_test.sql"
