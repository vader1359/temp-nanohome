# Plan 01 Handoff — Customer Data Foundation

## Commit boundary

- Base commit: `39340c7052ab0300c6988351d1190d30448a06ca`
- Scope: local-only customer identity, consent, event, RLS, deletion, remote capability, and tracker-consent foundation.
- No remote Supabase migration, deployment, push, merge, production enablement, generated database type change, environment-schema change, translation change, schedule change, or lockfile change occurred.

`FOUNDATION_SHA` is recorded after the scoped local commits, because a commit cannot contain its own final content-addressed SHA.

## Delivered artifacts

- Five additive Plan 01 migrations:
  - `20260721020000_plan01_customer_data_foundation.sql`
  - `20260721020500_plan01_customer_persistence_controls.sql`
  - `20260721021000_plan01_customer_persistence_rpc.sql`
  - `20260721022000_plan01_customer_persistence_hardening.sql`
  - `20260721023000_plan01_identity_race_hardening.sql`
- Token hashes only in persistence; visitor and session cookies are opaque, `HttpOnly`, `Secure`, `SameSite=Lax`, and never returned in the client context.
- Server-only RPC repository, consent projection, strict consent boundary, origin checks, and fail-closed identity persistence paths.
- Append-only consent and identity ledgers, RLS, bounded subject deletion worker, fixed-column allowlisted event storage, and session-scoped idempotency.
- Exact remote capability factory with origin/method/path/content-type/timeout/body-size/header/redirect constraints.
- Optional third-party tracker gating and teardown. Clarity uses `analyticsTracking`; Meta and Zalo use `marketingTracking`. The frozen Plan 00 client consent DTO remains unchanged.

## Explicit operational constraints

### Event ingestion remains fail closed

`POST /api/customer/events` returns `503 Event collection policy unavailable` until the owner approves payload and per-class/session/IP rate budgets. This is intentional: Plan 01 must not invent collection limits. The strict parser, persistence RPC, event-to-purpose rules, and idempotency storage are present but are not enabled by the route.

### Policy decisions still required

Before enabling shared deployment or collection, approve and configure:

1. visitor/session lifetime, rotation cadence, and renewal window;
2. event body/property/rate budgets and visibility authorization policy;
3. retention/anonymization schedule and legal order/payment exceptions;
4. consent policy-version lifecycle and allowed UI sources;
5. tracker/CSP/third-party cookie withdrawal behavior;
6. remote-capability owner feature-flag source and redacted operational logging;
7. authenticated guest-to-user merge proof/window semantics.

The authenticated guest-user merge is not enabled in this handoff. Do not fuzzy-link customer data or AMIS contacts.

## Local verification evidence

Passed:

- focused Vitest: 9 files, 53 tests;
- focused ESLint for all Plan 01 TypeScript/TSX paths;
- tracker network E2E: `e2e/customer-tracker-consent.spec.ts`, 1 passed;
- `supabase db lint --local` with no schema errors;
- `supabase/plan00-local/run-clean-reset.sh`;
- `git diff --check`.

Blocked or pre-existing failures:

- direct local `supabase db reset --local --no-seed && supabase test db --local supabase/tests/customer_data_foundation_test.sql` fails before Plan 01 test execution: historical local migration chain lacks `public.variants` (`SQLSTATE 42P01`). The isolated Plan 00 harness applies migrations but only runs its catalog pgTAP suite; it was not modified.
- full `corepack pnpm test`: 438/439 passed; unrelated `src/lib/queries/products.test.ts` fails because its mocked Supabase client lacks `rpc`.
- full `corepack pnpm exec tsc --noEmit` has unrelated errors in `src/app/api/products/route.test.ts` and `src/lib/products/filter-utils.test.ts`.
- full `corepack pnpm lint` has pre-existing errors in cart and Instagram test files; focused Plan 01 lint passes.
- TypeScript LSP diagnostics are unavailable because the server is not installed and installation was previously declined.

## Shared-environment gate

Do not apply these migrations remotely without the Plan 00 evidence bundle: environment owner and approval, read-only migration ledger/checksums, schema and RLS fingerprint, approved backup/recovery point, and additive-forward discrepancy resolution. Re-run the Plan 01 pgTAP suite in an isolated database whose historical baseline is complete.

## Rollback

Do not edit historical migrations. For local development, discard the ephemeral local database and rerun the isolated harness. For a shared environment, use a separately reviewed additive forward migration; retain consent/audit records as legal policy requires.
