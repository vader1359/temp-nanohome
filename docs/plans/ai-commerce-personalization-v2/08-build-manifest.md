# Plan 08 Build Manifest — Integrated Local Staging

## Status

**LOCAL STAGING INTEGRATED; LIVE ACTIVATION BLOCKED.** The committed heads for Plan 00–08 are merged into `codex/ai-commerce-staging` at `/home/iant1359/develop/temp-nanohome-ai-commerce-staging`. The branch starts from `main` commit `e920ab95b73cc80cac971e8ed7fb1afff1866db7`; the dirty `main` worktree was not changed.

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

## Merge resolutions

- `src/lib/contracts/ports.ts` keeps the canonical Plan 03 `CustomerMemoryPort`; Plan 07 differed only in whitespace.
- `supabase/plan00-local/run-clean-reset.sh` keeps both Vision and Personalization SQL tests.
- Migration filenames in the `20260721` program range are unique. Existing historical duplicates outside this program remain untouched.

## Validation boundary

The active staging guard checks all lane artifacts, expected migrations, server-only DeepSeek configuration, and default-off boundaries. Unit tests, TypeScript, UI merge guard, build, and a local HTTP smoke run are separate required commands in the runbook.

Remote SQL/RLS, generated database types, AMIS tenant access, ZaloPay merchant/sandbox callbacks, DeepSeek grounding, real vision provider/storage, privacy/retention approval, backup recovery, canary, and deployment remain blocked external gates.
