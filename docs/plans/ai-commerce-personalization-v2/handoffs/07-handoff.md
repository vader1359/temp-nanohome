# Plan 07 contract handoff

## Delivered artifacts

- Reconciled the Plan 03 customer-memory consumer contract in `src/lib/contracts/ports.ts`.
- Added consent/flag-gated resolver behavior and default-off flags in `src/lib/personalization/index.ts`.
- Added transparent preference, recently-viewed, and recommendation controls in `src/components/personalization/`.
- Prepared, unapplied migration: `supabase/migrations/20260721080000_plan07_customer_personalization.sql`.
- Added local-only SQL coverage: `supabase/tests/plan07_customer_personalization_test.sql` and wired it into `supabase/plan00-local/run-clean-reset.sh`.
- Privacy-minimized tables: `customer_preferences`, `customer_recent_entities`, `customer_affinities`, and `personalization_decisions`.
- Each table is subject-scoped through `public.customer_visitors`, cascades on visitor deletion, has expiry and soft-deletion timestamps, enables RLS, revokes `public`, `anon`, and `authenticated`, and grants only `service_role`. Invoker-safe active views exclude expired, deleted, or suppressed rows.

The migration stores only allowlisted IDs, tag keys, bounded enum-like values, scores, counts, versions, and timestamps. It has no JSON payload columns, CRM data, free text, raw event lists, room data, or security-definer functions. Withdrawal and deletion workers must mark applicable rows deleted or delete the visitor, which cascades the subject data. The local SQL test covers RLS, service-role access, lifecycle views, and cascade intent.

## Contract consumption rules

- Contract 03 is consumed only through `CustomerMemoryPort.getForAuthenticatedCustomer({ userId, purpose: "personalization" })`. The resolver calls it only for a non-null authenticated user ID with current personalization consent and enabled default-off flags. Treat a missing, stale, unlinked, withdrawn, unauthorized, or unavailable result as no memory, then render the curated fallback.
- Do not access AMIS or MISA directly. Plan 07 consumes customer memory only through the port and never stores or forwards raw CRM records, source IDs, notes, messages, addresses, or customer-visible summaries in these tables.
- Contract 05 supports PDP only. Other placements must stay curated until a placement-specific recommendation contract is delivered. Do not alter contracts or recommendation code to add homepage, cart, search, chat, or room recommendations.
- Explicit preferences override affinities. Recent entities remain short-lived browser subject utility. Affinities require personalization consent and must not be rebuilt from withdrawn or deleted data.
- Personalized modules must fall back to curated content whenever consent, context, customer memory, recommendation support, or canonical eligibility is unavailable.
- Default-off resolver flags are injected rather than read from environment state: `personalizationEnabled`, `recentlyViewedEnabled`, `explicitPreferencesEnabled`, and `customerMemoryEnabled`. Plan 08 owns production flag wiring and rollout. Affinity scoring, room-project context, and their flags remain deferred because Plan 07 has no source ports or trusted adapters for them.
- The preference center exposes reset, disable, and distinct customer-memory disconnect controls only when enabled and consented. Recently viewed and recommendation explanations use curated fallback text when disabled or when an explanation key is not allowlisted.

## Integration notes

Focused resolver and component Vitest suites pass, and ESLint passes for the changed TypeScript/TSX files. The repository TypeScript check still reports two unrelated pre-existing errors in `src/app/api/products/route.test.ts` and `src/lib/products/filter-utils.test.ts`. TypeScript LSP is unavailable because its installation was declined. `pnpm` is unavailable, so local binaries were used. The local Supabase harness was attempted with Supabase CLI 2.109.1 but could not start because Docker is unavailable; no SQL assertions ran.

This handoff changes no generated types, Plan 01 internals, Plan 03 adapter internals, Plan 05 recommendation implementation, AMIS or MISA integration, package files, or prior migrations. The migration remains unapplied and has not been sent to Supabase. Plan 08 must wire production flags/env, the trusted authenticated memory adapter boundary, page placement integration, affinity and room-project adapters, shared translations/global UI, generated types, consent-withdrawal worker hooks, and cleanup scheduling/rollout.
