# Plan 03 Personalization Lane Handoff

Status: local implementation complete; all AMIS sync, writes, and customer-visible rollout remain disabled.

## Scope and ownership

Branch: `codex/ai-commerce-amis-personalization`

Base: `e920ab95b73cc80cac971e8ed7fb1afff1866db7`

This lane implements the local Plan 03 surface:

- page-zero-safe, exact-path AMIS read clients for Customers, Contacts, and SaleOrders;
- restricted, Zod-parsed AMIS projections with no raw CRM payload exposure;
- active approved orders as purchases and active non-approved orders as `quoted_or_interested` signals;
- disabled-by-default personalization settings and an early route gate that avoids data reads while disabled;
- deterministic catalog recommendations for PDP, home, cart, and chat; and
- a restricted Customer Advisor context projection.

The lane does not own AMIS writes, live sync scheduling, shared identity schema, shared environment schema, `.env.example`, generated database types, lockfiles, or deployment.

## Commits

| Commit | Summary |
| --- | --- |
| `37c9d01` | Start AMIS SaleOrder reads at page zero. |
| `eaedb05` | Permit exact read-only Customer and Contact AMIS routes. |
| `d5dfbcf` | Add restricted AMIS Customer read port. |
| `bf6a042` | Add restricted AMIS Contact read port. |
| `7bfee78` | Classify safe AMIS customer-memory purchase and interest signals. |
| `c377bf9` | Add disabled personalization settings contract and local-only migration. |
| `12d5e84` | Gate personalization sources by settings and consent. |
| `01b497b` | Extend deterministic catalog recommendations. |
| `1d628fc` | Add restricted Customer Advisor context. |
| `8ea7eae` | Enforce safe deterministic customer-memory projection. |
| `40c295e` | Gate the customer personalization route before disabled reads. |

## Safety and disabled behavior

- AMIS client tests use synthetic fetch stubs only; no live tenant was called.
- Remote-read-only permits only exact `GET`/`HEAD` paths for Customers, Contacts, and SaleOrders. Generic mutation and unrelated entities remain denied.
- Customer and Contact ports strip all unconsumed fields. They expose only identifiers, safe relationship/type metadata, and modified timestamps.
- The AMIS mapper excludes freeform CRM summaries, notes, contact details, debt, pricing, addresses, and raw payloads. Customer Advisor context only contains explicitly allowlisted projected IDs and structured fields.
- Missing or invalid personalization settings resolve to a fully disabled policy. The customer route returns curated/default data before loading identity, consent, behavior, or customer-memory sources.
- Recommendation results remain canonical-catalog eligibility filtered, deterministic, and fall back safely for unsupported room placement.

## Verification

Passed locally:

```text
pnpm vitest run \
  src/lib/amis/sale-order-client.test.ts \
  src/lib/amis/customer-client.test.ts \
  src/lib/amis/contact-client.test.ts \
  src/lib/remote-read-only.test.ts \
  src/lib/amis-customer-memory/mapper.test.ts \
  src/lib/amis-customer-memory/advisor-context.test.ts \
  src/lib/personalization/settings.test.ts \
  src/lib/personalization/index.test.ts \
  src/lib/recommendations/service.test.ts \
  src/app/api/customer/personalization/route.test.ts
```

Result: **10 files, 107 tests passed**.

- `pnpm lint`: 0 errors; 18 pre-existing warnings in unrelated files.
- `pnpm build`: passed; compiled, typechecked, and generated 53 static pages.
- `git diff --check`: passed at handoff preparation.
- TypeScript LSP diagnostics were unavailable because the server installation was previously declined.

## Proposed Foundation and Integration deltas

The local migrations are additive proposals only and were not applied:

- `20260725110000_plan03_customer_personalization_settings.sql` creates a service-only `customer_personalization_settings` contract with all settings defaulting to disabled.
- The existing Plan 03 projection migration and this lane's safe projection fields require reconciliation with Foundation-owned identity ownership, generated types, and migration ordering before any application.
- Foundation should add any future feature-flag variable names and safe placeholders through its owned environment files; this lane intentionally did not edit `src/lib/env.ts` or `.env.example`.

## External blockers and owner actions

1. **AMIS tenant contract proof — owner: AMIS/operations.** Provide redacted Sandbox or tenant evidence for Customer, Contact, and SaleOrder pagination, maximum page size, stable links, exact approval value, deletion/cancellation/merge semantics, modified ordering, line SKU mappings, rate limits, and token renewal behavior. Do not enable reads or sync before this proof.
2. **Server-side settings reader and activation policy — owner: Foundation/Integration.** The current route intentionally calls `resolvePersonalizationSettings(undefined)` and exits disabled. A future activation needs an authenticated, service-side settings reader tied to Foundation's identity contract, consent policy, RLS proof, and explicit rollout controls.
3. **Restricted snapshot sync worker — owner: Integration/operations.** Implement only after contract proof: advisory lock, overlap watermark, bounded fetches, restricted snapshot/projection upserts, quarantine, audit-safe diagnostics, and reconciliation. It must remain read-only and must never persist raw CRM fields.
4. **Live migration and generated types — owner: Foundation/Integration.** Reconcile and test migration ordering locally, generate database types, then obtain explicit authorization before any remote application. No live migration was performed.

## Rollback and residual risk

Rollback is fail-closed: leave settings unresolved or disabled, and the personalization route serves curated/default modules without AMIS or private customer reads. The disabled client adapters are not a live synchronization implementation. The observed approval string `Đã duyệt` is synthetic/local contract behavior until tenant evidence freezes the exact value.
