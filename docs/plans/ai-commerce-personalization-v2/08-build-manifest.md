# Plan 08 Build Manifest — Integrated Local Staging

## Status

**LOCAL STAGING INTEGRATED; LIVE ACTIVATION BLOCKED.** The committed heads for Plan 00–08 and current `origin/main` commit `fd5b6dad3405` are merged into `codex/ai-commerce-staging` at `/home/iant1359/develop/temp-nanohome-ai-commerce-staging`. The local dirty `main` worktree remains at `e920ab95b73c` and was not changed.

This status means the code can be validated together on one local branch. It does not mean payment, AMIS, DeepSeek, vision, remote SQL, deployment, or production has been verified. All risky feature boundaries remain **default off** or fail closed.

## Merged receipt ledger

| Plan | Selected source | Integrated scope | Local runtime truth |
| --- | --- | --- | --- |
| Plan 00 | `codex/ai-commerce-program-base-v2` at `39340c7052ab` | Catalog eligibility, contracts, baseline SQL harness | Foundation present; source-worktree dirty files were not copied |
| Plan 01 | `codex/customer-data-foundation-v2` at `d56244fd9a7a` | Customer identity, consent, context, events, remote capability policy | Present with deny-safe persistence policy |
| Plan 02 | `codex/commerce-payment-amis-v3` at `cd158cca` | Commerce domain/routes, AMIS and ZaloPay adapters, checkout ledger migration | Plan 02 v3 only; local/in-memory composition, not live payment |
| Plan 03 | `codex/amis-customer-memory-v2` at `eb0ef7fad093` | Bounded customer-memory port, mapper, migration | Fixture/disabled adapter only; no live AMIS memory sync |
| Plan 04 | `codex/grounded-visual-chatbot-v2` at `ac661a95f6e2` | Public chat route, DeepSeek provider/orchestrator, retrieval/tool contracts | Route falls back safely until grounding and credentials are wired |
| Plan 05 | `codex/product-recommendations-v2` at `d5a37cc5f2ac` | Deterministic PDP recommendations | Mounted on the existing product detail page |
| Plan 06 | `codex/vision-intelligence-v2` at `78dcc2d64a50` | Vision contracts/services, synthetic provider, migration | No upload API, worker, or real model; flags are off |
| Plan 07 | `codex/customer-personalization-v2` at `c504611fed20` | Personalization resolver/components and migration | Components are not globally mounted; flags are off |
| Plan 08 | `codex/ai-commerce-integration-v2` at `3355b1978f10` | Readiness artifacts and guard | Guard converted from Foundation-only to integrated-staging checks |
| Latest main | `origin/main` at `fd5b6dad3405` | AMIS stock availability, contact pricing, Vase/Accessories classifications, nested translated filters | Merged after fetching; UI guard updated for the current products architecture |

## Merge resolutions

- `src/lib/contracts/ports.ts` keeps the canonical Plan 03 `CustomerMemoryPort`; Plan 07 differed only in whitespace.
- `supabase/plan00-local/run-clean-reset.sh` runs the Catalog, Customer Data, Commerce, AMIS Memory, Chat, Vision, and Personalization SQL suites together when Docker/Supabase is available.
- The unapplied Plan 03 migration is reconciled from source-lane `20260721024000` to reserved-range `20260721040000`; receipts retain the source filename for provenance.
- Migration filenames in the `20260721` program range are unique. Existing historical duplicates outside this program remain untouched.

## Validation boundary

The active staging guard checks all lane artifacts, expected migrations, server-only DeepSeek configuration, and default-off boundaries. The merged JavaScript/TypeScript suite currently passes 729 tests, TypeScript validation, lint with zero errors, both guards, and the Next.js production build. Local commerce deny-safe and chat fallback API smoke checks pass.

Data-backed locale-page smoke is not yet valid evidence: all WSL worktrees contain the same Supabase URL whose host no longer resolves, while the linked Vercel Preview environment currently returns the required Supabase values empty. Requests reach the Next.js server, but its logs show the failed data dependency. Replace this with an approved non-production Supabase environment before treating `/vi`, `/en`, or `/ko` as a complete staging smoke pass.

Remote SQL/RLS, generated database types, AMIS tenant access, ZaloPay merchant/sandbox callbacks, DeepSeek grounding, real vision provider/storage, privacy/retention approval, backup recovery, canary, and deployment remain blocked external gates.
