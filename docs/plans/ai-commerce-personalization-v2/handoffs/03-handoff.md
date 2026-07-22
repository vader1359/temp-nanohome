# Plan 03 Handoff: AMIS Customer Memory

Status: local implementation only; AMIS integration disabled

## Scope

Base SHA: `e920ab95b73cc80cac971e8ed7fb1afff1866db7`

This worktree adds the bounded `CustomerMemoryPort`, a strict synthetic AMIS allowlist mapper, disabled and fixture-backed port implementations, and an additive Plan 03 persistence lane. The mapper accepts only customer-safe type, tenure bucket, approved room/brand IDs, project stage, customer-visible summary, canonical purchased variants, and source timestamps. Unknown fields, contact details, prices, debt, and raw activity are dropped before the frozen `CustomerMemory` schema is parsed.

It does not call AMIS, use credentials, add live HTTP routes, modify generic remote capabilities, change chatbot/recommendation/personalization internals, add schedules or feature flags, change environment schema, generate database types, or expose customer memory to public assistant traffic.

## Contract and Safety

`CustomerMemoryPort.getForAuthenticatedCustomer({ userId, purpose })` accepts only a server-resolved user ID and `concierge` or `personalization` purpose. The fixture implementation returns memory only when the exact user has an active link, active source state, and consent for the requested purpose. Suspended, revoked, deleted, stale, consent-withdrawn, and cross-user requests return `null`. The disabled implementation always returns `null`.

The production port must preserve these rules: active verified link, purpose consent, fresh projection, source state, field policy, and safe outcome logging only. It must never look up by AMIS ID, email, phone, name, or address, and must never reveal whether another user's link exists.

Raw notes, calls, meetings, tasks, chat, attachments, and consultation cards remain unavailable. The reviewed AMIS OpenAPI paths document Customers, Contacts, Products/Stocks, SaleOrders, and token operations, not those activity objects. Use a documented tenant custom-field API, staff-approved Supabase brief, controlled export, or staff handoff. Do not scrape the AMIS UI.

## Persistence

The source lane produced `20260721024000_plan03_amis_customer_memory.sql`. Integrated staging renames it to `20260721040000_plan03_amis_customer_memory.sql` before any remote application so Plan 03 uses its reserved `2026072104xxxx` range and no longer overlaps the Plan 01 `2026072102xxxx` family. The migration adds:

- `customer_amis_links` with constrained lifecycle/method values and unique active customer ownership;
- `amis_customer_snapshots` with typed allowlisted fields, digests, mapper version, and lifecycle state;
- `amis_sale_order_summaries` with canonical variant IDs only;
- `customer_memory_projections` with user ownership and safe JSON envelope;
- `amis_sync_cursors` for future overlap-watermark synchronization.

Source tables, links, and cursors have RLS and no browser grants. Authenticated users receive select privilege only on the projection relation; its policy is user-owned. Sync and staff capabilities remain explicit follow-up work. The migration stores no raw AMIS payload, token, evidence secret, email, phone, address, price, debt, or note.

The pgTAP coverage is `supabase/tests/amis_customer_memory_test.sql`. It checks RLS, grants, source-column absence, safe projection access, and rejection of fuzzy link methods. Local application is required before treating the SQL as deployable. Do not apply remotely until the tenant contract and policy gates are approved.

## Synthetic Evidence

Focused Vitest coverage:

- `src/lib/amis-customer-memory/mapper.test.ts` proves unsafe customer/order fields do not enter the DTO and unmapped SKUs do not become invented variants.
- `src/lib/amis-customer-memory/customer-memory-port.test.ts` proves exact-user, active-link, purpose-consent access and null outcomes for inactive, unauthorized, cross-user, and disabled states.

Fixtures are synthetic and redacted. No production AMIS response or credential was used.

## Verification

Passed:

- `corepack pnpm exec vitest run src/lib/amis-customer-memory/mapper.test.ts src/lib/amis-customer-memory/customer-memory-port.test.ts` (5 tests)
- TypeScript changed-file diagnostics attempted; TypeScript LSP is unavailable because installation was previously declined.
- Changed TypeScript files are below the 250 pure-LOC ceiling.

Still required before merge/deploy:

- full Vitest, lint, and `tsc --noEmit` with pre-existing failures separated from Plan 03 failures;
- local Supabase reset/db lint and the Plan 03 pgTAP suite. The historical chain is known to be blocked before Plan 01 tests by missing `public.variants`; do not rewrite that history to make this suite pass;
- `git diff --check` and final scoped diff review.

## Production Blocker and Ownership

The production tenant/API contract spike is unresolved. Plan 08 must own approval and implementation of generic AMIS capability allowlists, tenant credentials/environment schema, schedules, feature flags, generated database types, authenticated settings UX, concierge wiring, and personalization consumption. Plan 03 owns the bounded mapper/port and restricted persistence contract only.

Before enabling a live worker, obtain redacted test-tenant evidence for pagination, ordering, timestamps, custom fields, deletion/merge behavior, relations, SKU lines, rate limits, token expiry/retry behavior, record-level failures, and incremental/webhook support. Define retention, stale-memory, consent, audited staff-link, conflict, reconciliation, and dead-letter ownership.

AMIS outage or disabled integration behavior is fail-closed: customer memory is `null`; public catalog, chat, and non-CRM personalization must continue through their existing paths. Customer-facing copy should offer staff handoff for inaccessible history without exposing internal records.
