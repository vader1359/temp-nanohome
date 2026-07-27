# Foundation Integration Handoff — Todo 22 Final Record

## Commit boundary

Dependency base: `8e8c962` (`docs: consolidate AI commerce v3 execution plan`).

Foundation commits, in delivery order:

| SHA | Message |
| --- | --- |
| `0dcabd4` | `feat(db): add internal customer account identity spine` |
| `eb5da6a` | `feat(contracts): add provider-neutral payment port` |
| `13f22be` | `feat(env): validate provider modes conditionally` |
| `e3047ba` | `docs(env): document safe provider defaults` |
| `3c44b44` | `fix(test): make local Supabase harness self-contained` |
| `5e35e37` | `feat(auth): add server account session contract` |
| `2f34e16` | `feat(db): add forward migrations for legacy account ownership` |
| `abb676f` | `feat(types): regenerate database types from local migration proof` |
| `dc950ce` | `test(harness): correct Decision A chronology to per-domain fixture order` |
| `3273f73` | `fix(harness): stabilise full-suite SQL gate invocation` |
| `d9762e5` | `feat(db): add catalog eligibility and offer reservation schema` |
| `f99c37f` | `feat(db): add customer event personalization pipeline schema` |
| `2fa3817` | `feat(db): add checkout ledger and payment evidence schema` |
| `57b2d6a` | `chore: final Foundation integration tidy and gate record` |

Handoff commit: [TBD — local scoped commit]

## Delivered Foundation contracts

| Area | Delivered | Integration rule |
| --- | --- | --- |
| Account identity | Additive internal `customer_accounts` mapping and Firebase-principal schema; resolver ignores browser-provided account IDs and accepts mapped non-UUID subjects. | Commerce/profile read and update policies use strict configured legacy-claim or internal-account resolution; write cutover remains deferred. |
| Session boundary | `src/lib/account-session.ts` defines server-only session-cookie, external-subject, and internal-account abstractions with no Supabase bearer-token field. | A Firebase session cookie must be verified server-side only; never forward it as a Supabase bearer token. |
| Payment port | `PaymentGateway` defines create/retrieve/cancel-unpaid/verify-notification results without installing a provider SDK or performing I/O. | Checkout owns adapter/orchestration adoption; do not treat browser payment input as verified evidence. |
| Checkout ledger | Forward schema for payment evidence, ledger entries, and idempotency keys. | Payment becomes `paid` only after a verified IPN or server-to-server reconciliation; a browser redirect cannot mark an order paid. |
| Catalog eligibility | Forward schema for offer reservation, eligibility windows, and order-adjustment rules. | No external pricing logic may bypass the server eligibility check. |
| Customer event pipeline | Forward schema for personalization events, projection snapshots, and dead-letter records. | Raw AMIS records never enter the browser or model prompt; only safe projection snapshots are exposed. |
| Environment | Safe defaults are `AUTH_PROVIDER=supabase`, `PAYMENT_MODE=off`, and `CHAT_ENABLED=false`; Firebase and SePay validation activates only in their enabled modes. | Keep external providers disabled until approved credentials and provider-specific integration proof exist. |
| Local pgTAP harness | Starts and tears down its own local Supabase stack, invokes only `--local` reset/lint/test commands. Decision A harness (`dc950ce`) temporarily stages all post-`20260725000100` migrations aside in a disposable copy, replays the immutable `20260726000000_foundation_decision_a_identity_fix.sql` in the historical 8-FK context, then restores all migrations; it does not modify any migration or test file. | Never pass `--linked` or a remote database URL; local Docker must be available before use. |
| Generated types | `src/types/database.types.ts` regenerated from local migration proof after Foundation migrations applied. | Do not hand-edit generated types; regenerate from a clean local reset after any schema change. |

## Migrations and data safety

Forward-only migrations delivered in this Foundation boundary (inventory; not all timestamps are ascending):

1. `20260724000000_foundation_customer_identity_accounts.sql`
2. `20260725000000_foundation_legacy_account_ownership.sql`
3. `20260725000100_foundation_legacy_account_ownership_rls.sql`
4. `20260721010000_plan00_catalog_eligibility.sql`
5. `20260723090000_customer_event_personalization_pipeline.sql`
6. `20260721030000_add_commerce_checkout_ledger.sql`

The ownership bridge adds nullable `account_id` mappings, legacy backfill/assignment triggers, and dual read/update RLS for carts, orders, related item/history rows, and profiles. Existing legacy columns, guest paths, insert policies, checkout RPC, and profile trigger are preserved.

No historical migration was changed. No live migration, remote schema query, deployment, provider activation, credential creation, or external service mutation was performed.

`customer_identity_providers` defaults to empty, so no external JWT issuer is trusted until privileged provisioning explicitly configures one.

`current_customer_account_id()` fails closed on malformed claims; it checks exact configured issuer/audience, authenticated role, active principal/account state, and does not trust a browser account claim.

## Decision A harness

Decision A refers to the targeted pgTAP fixture suite for the Foundation identity lane: **1 file, 19 tests**.

`dc950ce` implements the Decision A harness. When invoked with `--target foundation-decision-a`, the harness temporarily stages all post-`20260725000100` migrations aside in a disposable copy, replays the immutable `20260726000000_foundation_decision_a_identity_fix.sql` in the historical 8-FK schema context, then restores all migrations to their original positions. This lets the fixture run against the exact schema state the migration was written for, without altering any migration file or test assertion.

## Verification evidence

### App gate (passed)

| Check | Result |
| --- | --- |
| `pnpm exec vitest run` | 151 files, 962 tests, **PASS** |
| `pnpm exec tsc --noEmit` | **0 errors** |
| `pnpm lint` | **0 errors, 18 warnings** (all pre-existing) |
| `VISION_PROVIDER=off next build --webpack` | **53 routes, build PASS** |
| `git diff --check` | **clean** |

### Foundation pgTAP gate (passed, targeted)

Decision A targeted command: `timeout 900 bash supabase/plan00-local/run-clean-reset.sh --target foundation-decision-a`

- **1 file, 19 tests, Result: PASS** (run twice, both PASS)

Foundation targeted command: `timeout 900 bash supabase/plan00-local/run-clean-reset.sh --target foundation`

- **13 files, 433 tests, Result: PASS**

### Full SQL gate (m3, non-zero)

Full command: `timeout 900 bash supabase/plan00-local/run-clean-reset.sh --full`

- Exit: **1**
- Files: **21**, Tests: **593**, Result: **FAIL**
- **13 Foundation files and Decision A passed.**
- **Seven sibling suite failures remain, classified and unsuppressed:**

| Failing file | Exact cause |
| --- | --- |
| `amis_customer_memory` | AMIS sync column asserted as non-boolean; actual column type is `text` |
| `catalog_eligibility` | Malformed array literal in `price_missing` fixture value |
| `commerce/checkout_ledger` | `permission denied for table commerce_checkouts`; secondary expiry timestamp mismatch |
| `customer_event_personalization_pipeline` | Canonical product/variant resolution error raised before consent fixture runs |
| `plan07_customer_personalization` | Preference check constraint violation in plan07 fixture |
| `rls` | `permission denied for table brands` |
| `vision_persistence` | `prosrc` column absent on PG 14+; affects tests 15, 16, and 46 |

These failures are pre-existing relative to the Foundation lane, are not caused by Foundation commits, and are not suppressed. The full-suite gate remains non-zero and is expected to stay non-zero until each sibling lane delivers its own schema, seed, and fixture work.

## Operational guardrails

- Do not pass `--linked` or a remote database URL to any harness command.
- Do not activate `AUTH_PROVIDER=firebase`, `PAYMENT_MODE=live`, or `CHAT_ENABLED=true` until approved credentials and provider-specific integration proof exist.
- Do not stage, commit, push, merge, link, deploy, or expose any production secret, PII, or protected container change.
- `customer_identity_providers` must remain empty in all non-production environments until explicitly provisioned by a privileged migration.
- Generated types must be regenerated from a clean local reset, not hand-edited.

## Production and shared gate policy

No production change, shared branch merge, or live service mutation is included in or permitted by this handoff. All work is local-scoped. The shared/production gate requires:

- all seven sibling SQL failures resolved with their own lane fixtures;
- full-suite `--full` gate passing exit 0;
- a separate, reviewed production deployment record.

This handoff does not constitute production approval.

## Rollback

- Session/contract changes: revert their bounded commits by SHA.
- Local test database: harness teardown removes the temporary local stack and data; no shared rollback action exists.
- Identity schema: if a later approved shared deployment requires reversal, use a separately reviewed additive forward migration; never edit or rename historical migrations.
- Generated types: if regenerated types introduce a regression, revert `abb676f` and re-run `tsc` to confirm the revert is clean.

## Closed items

The following items from prior handoff drafts are now closed and must not appear as remaining work:

- Docker/WSL local harness repair: delivered in `3c44b44`.
- Decision A chronology fix: delivered in `dc950ce`.
- Type regeneration after local migration proof: delivered in `abb676f`.
- Catalog eligibility, customer event pipeline, and checkout ledger schema: delivered in `d9762e5`, `f99c37f`, `2fa3817`.

No remaining Foundation work is deferred from this boundary. Subsequent lanes own their own schema, seed, fixture, and gate work independently.
