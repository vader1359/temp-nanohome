# Plan 08 Handoff — Integrated Local Staging

## Delivery

The local WSL branch `codex/ai-commerce-staging` merges the committed Plan 00–08 heads and current `origin/main` at `fd5b6dad3405`. Plan 02 v3 at `cd158cca` is the selected commerce source. Obsolete Plan 02 v2 and all dirty source-worktree artifacts were excluded; the dirty local `main` worktree stayed untouched at `e920ab95b73c`.

Merge order: Plan 00, Plan 01, Plan 02 v3, Plan 03, Plan 05, Plan 04, Plan 06, Plan 07, Plan 08, then current `origin/main`.

## Resolved conflicts

- `src/lib/contracts/ports.ts`: retained the canonical Plan 03 implementation because the Plan 07 side was identical apart from indentation.
- `supabase/plan00-local/run-clean-reset.sh`: combined all seven program SQL suites in dependency order.
- `src/lib/queries/products.test.ts`: kept latest-main AMIS stock/facet coverage and the RPC fallback mock needed by the combined suite.

## Operational truth

The merged branch is an integration and validation target, not a claim that every feature is live. PDP recommendations are already mounted. Commerce, customer memory, chat, vision, and personalization retain safe fallback/default-off behavior until their adapters, credentials, remote database work, i18n/UI mounts, and external approvals are completed.

The active `scripts/plan08-readiness-guard.mjs` now validates integrated artifacts rather than rejecting them as it did on the historical Foundation-only lane.

## External gates

Remote SQL/RLS and generated types, a usable non-production Supabase URL/key set, AMIS tenant proof, ZaloPay sandbox/callback/reconciliation, DeepSeek grounding and credentials, real vision storage/provider, privacy/retention, backup/recovery, monitoring, canary, and deployment remain unverified. The current inherited Supabase hostname does not resolve; Vercel Preview currently supplies the required Supabase variables without usable values.

**No push, deploy, production enablement, or remote database change** is included in this handoff.
