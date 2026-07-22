# Worktree 02 Handoff: Commerce, Payment, and AMIS

Source: `d56244f` base, local branch `codex/commerce-payment-amis-v3`.
Migration: `20260721030000_add_commerce_checkout_ledger.sql`; forward-only local
worktree change. Rollback/repair must be reviewed by Plan 08 before application.

## Scope

This branch implements locally testable Plan 02 contracts and deny-safe
composition for commerce checkout, inventory holds, AMIS, and ZaloPay. It does
not enable production integrations or claim durable production persistence from
the in-memory test composition.

Protected files were not changed: generated database types, the global remote
read-only guard, package or lock files, shared environment validation, global
providers, shared translations, Vercel configuration, and existing legacy cart
submission routes.

## Implemented Locally

- Exact raw SKU and warehouse-ID parsing and comparison; whitespace, case, and
  punctuation are preserved as supplied by the server catalog or AMIS boundary.
- Independent business, inventory, AMIS, payment, and refund state contracts,
  with typed paid evidence and immutable local order snapshots.
- Server-owned cart and checkout schemas. Browser price, SKU, total, owner, and
  payment flags are not trusted. Repeated owner plus idempotency key and the
  same payload hash returns the local snapshot; a changed hash conflicts.
- Catalog eligibility is consumed when supplied by the server catalog boundary;
  cart and payment capabilities must both be true before local checkout.
- Actual Next Web Request/Response handlers under `src/app/api/commerce` for
  cart replacement, checkout creation, and owner-protected order reads. The
  default route composition denies owner resolution and uses a test-only local
  repository.
- Complete paginated AMIS stock ledger reading with fail-closed malformed,
  missing, duplicate, stale, and insufficient outcomes. Digest canonicalization
  is independent of page order.
- Separate AMIS read and Sale Order write capabilities. Sale Order creation is
  independently feature-gated, tenant-proof-gated, and restricted to exact
  `POST /api/v2/SaleOrders`; reconciliation uses the approved GET capability.
  Ambiguous creates reconcile by order code and never blindly POST again.
- Deterministic 10-minute website-hold boundary with injected clock and
  repository ports. Active holds subtract once; release and expiry are
  idempotent in the local fake.
- ZaloPay-only typed adapter seams for create, query, callback verification,
  refund, and refund query. Key1/Key2 signing, raw callback MAC verification,
  amount and transaction binding, redirect-not-paid behavior, full-refund-only
  behavior, and query-refund finality are covered without network calls.
- Additive SQL ledger migration with raw byte collation, unique identifiers,
  append-only payment/refund ledgers, service-role-only direct writes, and
  database-owned ten-minute hold expiry.

## Evidence

Focused local commerce and route verification:

```text
corepack pnpm exec vitest run src/lib/commerce src/app/api/commerce
23 files passed, 80 tests passed
```

Focused lint after removing unused imports:

```text
corepack pnpm exec eslint src/lib/commerce src/app/api/commerce
0 errors, 0 warnings
```

The TypeScript LSP is unavailable because installation was previously declined.
The repository typecheck runs but reports two unrelated existing product-test
errors in `src/app/api/products/route.test.ts` and
`src/lib/products/filter-utils.test.ts`.

The local Supabase reset was attempted with
`supabase/plan00-local/run-clean-reset.sh` and stopped before migration
execution because Docker is unavailable:
`Cannot connect to the Docker daemon at unix:///var/run/docker.sock`.
`psql` is unavailable. No linked or remote database was contacted.

## Required Plan 08 Work

Public contract version: local v0, not production-compatible until the durable
composition and generated types are reviewed. Safe defaults are deny owner
resolution, disabled AMIS writes, disabled payment/refund operations, and no
live external calls. Required metrics and alerts include checkout conflicts,
hold expiry/release, AMIS ambiguity, callback rejection/replay, refund
processing/manual review, and reconciliation age. Runbooks must define owner,
SLA, kill switch, rollback, and incident escalation for each metric.

Before any production enablement, Plan 08 must complete and document:

1. Regenerate and review `src/types/database.types.ts` after the final schema,
   including durable immutable order snapshots, checkout attempts, inventory
   checks/holds, append-only histories, refund cases/actions, outbox, and RPCs.
2. Replace the local in-memory repository composition with reviewed Supabase
   implementations providing transactionality, uniqueness, owner RLS, atomic
   holds, replay-safe idempotency, and crash recovery.
3. Prove the AMIS tenant mapping, warehouse identity, Sale Order draft effects,
   exact reconciliation GET contract, token refresh behavior, and draft-versus-
   reservation semantics in a non-production tenant.
4. Configure ZaloPay merchant sandbox credentials outside this worktree and run
   callback, authenticated query, full refund, query-refund, settlement, amount
   limit, timeout, and ambiguous-response drills. No redirect may establish
   paid state.
5. Own server-only environment configuration, authenticated scheduler/worker
   execution, callback URL, outbox delivery, alerting, reconciliation SLA,
   operational owners, and safe feature-mode kill switches.
6. Integrate shared providers and translations without allowing the browser to
   provide commercial truth. Add UI status composition only after the server
   route and payment state contracts are wired to durable implementations.
7. Complete canary, daily reconciliation, refund exception, rollback, and
   incident drills. This branch performed no live AMIS/ZaloPay proof, no remote
   database mutation, no deployment, and no production feature enablement.

## Files To Review

- `src/lib/commerce/domain.ts`, `repository.ts`, and `transition-policy.ts`
- `src/lib/commerce/commerce-local.ts` and `server-owned-routes.ts`
- `src/app/api/commerce/cart/route.ts`
- `src/app/api/commerce/checkout/route.ts`
- `src/app/api/commerce/orders/[orderId]/route.ts`
- `src/lib/commerce/amis-reader.ts`, `amis-capability.ts`, and
  `amis-sale-order.ts`
- `src/lib/commerce/inventory-orchestrator.ts` and `inventory-repository.ts`
- `src/lib/commerce/zalopay-adapter.ts` and signing/state/refund policy tests
- `supabase/migrations/20260721030000_add_commerce_checkout_ledger.sql`
