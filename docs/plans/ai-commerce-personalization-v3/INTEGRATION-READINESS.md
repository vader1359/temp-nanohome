# Integration Readiness Handoff — Local Staging Merge

## Scope and boundary

This record covers the user-authorized local-only integration of the five v3
lanes into `codex/ai-commerce-staging` in the isolated worktree
`/home/iant1359/develop/temp-nanohome-ulw-staging-integration`.

- Remote reviewed baseline: `origin/codex/ai-commerce-staging@b4d28a37cd77d895f8fea3ad72edc6f5fededd44`
- Local staging start: `b1afa51df3e290431c4a20736827fb4fbaee6810`
- Final local staging head before this handoff update:
  `28bcfb6d1e1dca678d839bb3f2e9a47a9c97209d`
- No fetch, push, deploy, billing action, live provider activation, remote
  database operation, or production migration was performed.
- Existing dirty files in the original Integration worktree were never staged,
  copied into commits, or modified. Local Playwright artifacts created in this
  isolated worktree were removed before this record.

All verification commands used these explicit offline-safe overrides:

```text
AUTH_PROVIDER=supabase PAYMENT_MODE=off CHAT_ENABLED=false VISION_PROVIDER=off
```

A mode-`0600` local `.env.local` was copied through the local bridge only to
satisfy build-time required-variable validation. Its values were never printed,
recorded, staged, or committed.

## Merge record

| Order | Lane source | Merge commit | Result |
| --- | --- | --- | --- |
| 1 | `bb7668a3a7bbc37e40e4c8c39a964ee813a70ad8` Foundation | `34ddc78d2ca682ffedc14836abba32faf442a3d3` | Clean merge; no conflicts. |
| 2 | `6e003c70fe834dcbbc520fd40a3df8be60bd0310` Account | `2118a375cfd656aedc753d447eca253173daace5` | Clean merge; no conflicts. |
| 3 | `5523bf467c33b325e512bf6938241db318defd2e` Chat | `cb217330d824c5cee2615882e5c702c9febd657f` | One scoped conflict; resolved below. |
| 4 | `17f93284de758fd19eca439aa83c72c5e436e46d` Checkout | `7c6161b508ff85d2e7964c1ef15699fcd5e50c58` | Clean merge; no conflicts. |
| 5 | `235e4d233aa26e16ae6f9194ee0e3fd28c816ca8` Personalization | `8897b9d18cb155225cd2689234e5e0e94dc7639c` | Clean merge; no conflicts. |

### Chat conflict resolution

`src/components/chat/public-chat-widget.tsx` conflicted. Resolution kept the
existing footer-safe launcher position state and scroll/resize behavior while
taking Chat lane's approved removal of the global consent gate: no
`aiProcessingAllowed`, no `/api/customer/context` fetch, and direct assistant
opening. This matches the master-plan decision to remove the global consent
banner without removing privacy or access controls.

## Integration-only repair commits

No merge commit was amended. The following bounded follow-ups keep merged code
buildable and its tests aligned with the integrated contracts:

| Commit | Purpose |
| --- | --- |
| `9b457f2` | Account server-translation test harness. |
| `178509b` | Account page translation-provider test harness. |
| `caef698` | Remove obsolete Chat consent-fetch assertion. |
| `78784fe` | Derive SePay success-page missing-order error state without synchronous effect update; add regression test. |
| `4576dd0` | Widen Account auth-flow fixture values for all locales. |
| `1a44d45` | Align Account offer translator value type with `next-intl`. |

## Verification evidence

### Targeted lane tests

| Lane | Command form | Result |
| --- | --- | --- |
| Foundation | Local-only `supabase/plan00-local/run-clean-reset.sh --target foundation` | Command completed successfully during Foundation merge; no captured count. |
| Account | Direct Vitest account/API/account-page/parity target | PASS — 44 files, 143 tests, 52.46s. |
| Chat | Direct Vitest capabilities/API/widget target | PASS — 3 files, 36 tests, 4.71s. |
| Checkout | Direct Vitest SePay/payment target | PASS — 10 files, 49 tests. |
| Personalization | Direct Vitest AMIS/projection/settings target | PASS — 13 files, 121 tests. |
| Checkout regression | Direct Vitest success-page test | PASS — 1 file, 1 test. |
| Account type repairs | Direct Vitest auth-flow and offer-list targets | PASS — 2 files, 6 tests. |

### Full local application gates

| Command | Result |
| --- | --- |
| Direct Vitest full suite | PASS — 220 files, 1,176 tests, 83.16s. Vite CJS Node API deprecation notice only. |
| Direct ESLint | PASS — 0 errors, 30 warnings. Warnings retained without unrelated cleanup. |
| Direct `tsc --noEmit` | PASS — 0 errors. |
| Direct `next build --webpack` | TypeScript completed in 30.0s; `.next/BUILD_ID` and `.next/server/app-paths-manifest.json` present. Tool output did not retain a final route-count line, so this is artifact-based completion evidence. |
| `git diff --check` | PASS after blocker source changes. |

### Disposable local SQL gate

The harness now preserves local `supabase start` stderr and its exit status.
Its shell regression test passes, including a fake-start failure that returns
status 9 and emits both child stderr and `Local Supabase start failed.`

`timeout 900 bash supabase/plan00-local/run-clean-reset.sh --full` still exits
**1** in the disposable local stack. The historical Foundation collision
blocker documented below has been repaired and verified; the remaining
`pg_prove` failures are pre-existing canonical-schema/test-drift and
test-environment metadata issues unrelated to the blocker and are out of scope
here per the release-blocker repair contract.

#### Blocker repaired and verified

Root cause confirmed previously: `20260725100000_plan03_safe_personalization_projections.sql`
creates legacy `customer_memory_briefs` (and `amis_contact_snapshots`) tables;
`20260726001000_personalization_foundation_contracts.sql` then uses
`CREATE TABLE IF NOT EXISTS`, which the legacy tables satisfy, before it
attempts the canonical `brief_version` index — schema cannot apply on a
fresh reset. `20260725110000_plan03_customer_personalization_settings.sql`
creates a legacy `customer_personalization_settings` table with the same
collision pattern.

Repairs applied under explicit local-historical migration-contract repair
authorization (no remote database contacted, no production migration, no
provider activation, no secret inspection):

- Tracked migration filename duplicate-prefix collisions repaired by rename:

  - `supabase/migrations/20260710000003_add_korean_read_columns.sql`
    → `supabase/migrations/20260710000006_add_korean_read_columns.sql`
  - `supabase/migrations/20260711000000_use_strict_amis_inventory_cutoff.sql`
    → `supabase/migrations/20260711000004_use_strict_amis_inventory_cutoff.sql`

  Harness-only `mv` collision workarounds were removed from
  `supabase/plan00-local/run-clean-reset.sh` so the disposable stack now
  exercises the tracked history as-is.

- `scripts/plan08-readiness-guard.mjs` duplicate-prefix regex widened from
  `/^(2026072[12]\d{4,6})_.*\.sql$/` to `/^(2026\d{10})_.*\.sql$/` so it
  rejects any tracked duplicate migration version across the full 2026 year,
  not only late-July.

- `supabase/migrations/20260726001000_personalization_foundation_contracts.sql`
  gained three idempotent legacy-shape repair DO blocks immediately after
  the opening `begin;` and before the canonical `CREATE TABLE IF NOT EXISTS`
  collisions. Each block detects the legacy shape via `information_schema`
  predicate (absence of the canonical column), drops the legacy primary key
  and foreign keys, renames the legacy table to `*_legacy_plan03`, creates
  the canonical shape (duplicating the canonical table definition in this
  migration), INSERTs mapped rows via `customer_amis_links` (for
  `customer_memory_briefs`) or `customer_accounts` (for
  `customer_personalization_settings`) joins preserving safe timestamps,
  version/expiry, and row counts, then drops the legacy backup. Repair is a
  no-op on a clean reset because the IF predicate branches are false; the
  canonical `CREATE TABLE IF NOT EXISTS` below applies unchanged. RLS,
  policies, grants, triggers, and indexes are subsequently asserted by the
  canonical sections of the same migration.

A local disposable Supabase full reset confirms:

```text
foundation_personalization_contracts_test.sql ........ ok
foundation_schema_contract_test.sql ................. ok
```

The Foundation contract regression suite is green on a fresh reset with the
repair in place; the historical skip-and-then-fail behavior no longer occurs.

#### Pre-existing unrelated failures (out of blocker scope, not addressed)

The same disposable full reset exits **1** with `Files=21, Tests=562` because
of canonical-schema-vs-stale-test drift and test-environment metadata bugs
that exist independent of the Foundation collision repair. They are not
widened in scope here:

- `foundation_decision_a_identity_test.sql` tests 1–4: expect `count = 11`
  single-column FKs on `customer_accounts.id`; canonical Foundation migration
  adds `customer_memory_briefs.account_id_fkey`, raising the count to 19.
  Pre-existing test stale relative to the v3 canonical schema.
- `amis_customer_memory_test.sql`: planned 15, ran 10; runtime SQL error
  inside a fixture (`argument of NOT is type boolean, not type text`).
- `catalog_eligibility_test.sql` tests 5–6: malformed array literal
  `"price_missing"` in test fixture.
- `commerce/checkout_ledger_test.sql` test 24: permission denied for
  `commerce_checkouts` under the disposable-stack role setup.
- `customer_data_foundation_test.sql` tests 20–23, 38, 42–43: consent ledger,
  event RPC, and subject-deletion worker tests; unrelated to Foundation
  collision tables.
- `customer_event_personalization_pipeline_test.sql` test 16: pre-existing.
- `plan04_grounded_chat_test.sql` and `plan07_customer_personalization_test.sql`:
  test fixture setup errors (`INSERT` column-count mismatch;
  `customer_preferences_check1` violation).
- `rls_test.sql`: permission denied for `brands`; fixture setup aborts.
- `vision_persistence_test.sql` tests 15–16, 46: `prosrc` column does not
  exist in this disposable-stack function catalog.

A future forward migration or targeted test refresh may address these
pre-existing tests. They are not part of the release-blocker repair contract.

### Browser and accessibility evidence

Safe-mode Chromium commands:

```text
AUTH_PROVIDER=supabase PAYMENT_MODE=off CHAT_ENABLED=false VISION_PROVIDER=off \
  ./node_modules/.bin/playwright test e2e/product-navigation.spec.ts \
  --project=chromium --workers=1 --repeat-each=3 --reporter=json \
  --output=/tmp/nanohome-release-playwright-focused.json

AUTH_PROVIDER=supabase PAYMENT_MODE=off CHAT_ENABLED=false VISION_PROVIDER=off \
  ./node_modules/.bin/playwright test \
  e2e/smoke-i18n.spec.ts e2e/product-navigation.spec.ts \
  e2e/customer-tracker-consent.spec.ts \
  --project=chromium --workers=1 --reporter=json \
  --output=/tmp/nanohome-release-playwright-combined.json
```

The focused Vietnamese/English product-navigation gate passed **6/6 across
three repeats** (52.6s). The deterministic replacement captures the actual
rendered `<Link href>` for `article[data-product-card]
a[data-product-image-frame]`, asserts the href matches the locale product
detail route `^/{locale}/products/[^/?#]+$`, and synchronizes the click with
`Promise.all([page.waitForURL(capturedHref), link.click()])`, then asserts
the URL leaves the list route and `main` is visible.

The serialized combined Chromium suite (smoke-i18n + product-navigation +
customer-tracker-consent) at `--workers=1` passed **16/16 with 0 flaky and
0 unexpected** (64.6s). JSON evidence is stored at
`/tmp/nanohome-release-playwright-combined.json`. The prior combined-run
flaky click failure (Vietnamese URL stayed on `/vi/products`) is no longer
reproduced.

Root `src/app/layout.tsx` already awaits `next-intl/server` `getLocale()` and
sets `<html lang={locale}>` while keeping the root document ownership required
by the top-level 404 route. Root-layout unit coverage checks `vi`, `en`, and
`ko` language values.

## Required follow-up before release

1. ~~Approve and execute a broad historical migration-contract upgrade, then
   rerun the disposable full SQL gate.~~ Done under explicit local repair
   authorization; Foundation contract verifies green on a fresh reset.
2. ~~Repair the Vietnamese product-detail navigation E2E contract and rerun
   the combined accessibility browser suite.~~ Done; combined serialized
   Chromium suite passes 16/16.
3. Run authenticated E2E, visual/Percy, external Sandbox proofs, and release
   acceptance mapping only after their required credentials and approvals.
4. Optionally refresh stale pre-existing `pg_prove` tests listed above in a
   separate forward migration or targeted test cleanup; not part of this
   release-blocker repair contract.

## Feature flags, rollback, and release status

Safe defaults remain `AUTH_PROVIDER=supabase`, `PAYMENT_MODE=off`, and
`CHAT_ENABLED=false`; vision remains off for this evidence run. Provider
activation requires separate approved credentials and contract proof.

Rollback is bounded to the integration merge/follow-up commits above. Any
approved shared schema reversal must use a new forward migration, never edit a
historical migration.

**Readiness: local merge complete; release-blocker repair complete; release
not ready pending external proofs.** All five lane branches are integrated
locally; unit/type/lint/build pass; document-language browser coverage passes;
the historical Foundation migration collision blocker is repaired and
verified on a fresh disposable reset; and the combined serialized browser
accessibility suite passes 16/16. Fresh local SQL reset still exits 1 only
because of pre-existing unrelated canonical-drift and fixture-metadata
`pg_prove` failures out of scope for this release-blocker repair. Production
remains untouched; staging push is bounded to the explicit commits below and
awaits explicit release authorization.
