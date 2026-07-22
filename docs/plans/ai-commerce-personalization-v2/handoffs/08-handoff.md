# Plan 08 Handoff — Integrated Local Staging

## Delivery

The local WSL branch `codex/ai-commerce-staging` merges the committed Plan 00–08 heads on top of `main` commit `e920ab95b73cc80cac971e8ed7fb1afff1866db7`. Plan 02 v3 at `cd158cca` is the selected commerce source. Obsolete Plan 02 v2 and all dirty source-worktree artifacts were excluded.

Merge order: Plan 00, Plan 01, Plan 02 v3, Plan 03, Plan 05, Plan 04, Plan 06, Plan 07, then Plan 08.

## Resolved conflicts

- `src/lib/contracts/ports.ts`: retained the canonical Plan 03 implementation because the Plan 07 side was identical apart from indentation.
- `supabase/plan00-local/run-clean-reset.sh`: combined both Vision and Personalization copy/test entries.

## Operational truth

The merged branch is an integration and validation target, not a claim that every feature is live. PDP recommendations are already mounted. Commerce, customer memory, chat, vision, and personalization retain safe fallback/default-off behavior until their adapters, credentials, remote database work, i18n/UI mounts, and external approvals are completed.

The active `scripts/plan08-readiness-guard.mjs` now validates integrated artifacts rather than rejecting them as it did on the historical Foundation-only lane.

## External gates

Remote SQL/RLS and generated types, AMIS tenant proof, ZaloPay sandbox/callback/reconciliation, DeepSeek grounding and credentials, real vision storage/provider, privacy/retention, backup/recovery, monitoring, canary, and deployment remain unverified.

**No push, deploy, production enablement, or remote database change** is included in this handoff.
