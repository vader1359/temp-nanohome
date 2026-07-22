# Plan 04 Handoff - Grounded Visual Chatbot

## Commit boundary

This handoff covers the local public server boundary for grounded chat. It does not merge, push, deploy, enable production, call a remote database, call DeepSeek, or print secrets.

Included scope:

- `src/app/api/chat/`
- `src/lib/chat/`
- server-only DeepSeek configuration remains an integration prerequisite; this lane does not edit the shared environment schema
- `supabase/migrations/20260721050000_plan04_grounded_chat_persistence.sql`
- `supabase/tests/plan04_grounded_chat_test.sql`

Explicitly excluded from this worktree's commits:

- `entities.json`
- `mempalace.yaml`
- `.omo/run-continuation/` runtime metadata
- `src/lib/env.ts` shared schema changes
- lockfiles, generated types, shared translations, AMIS internals, customer linking, recommender internals, vision internals, schedules, and shared product-card redesign

## Delivered locally

- Public chat request and strict NDJSON event contracts with deterministic response IDs, no-store responses, bounded input, cancellation, duplicate-request sharing, and safe fallback events.
- Public policy boundary for prompt injection, private/customer/order/staff access, commercial promises, policy exceptions, exact-fit guarantees, and unsupported room-photo analysis.
- Approved-source lexical retrieval and typed public tools, with server-resolved product/comparison/image/link/handoff blocks.
- DeepSeek provider adapter that sends bounded text-only requests with `stream: true`, consumes mocked SSE, ignores keep-alives and reasoning content, validates JSON output, and returns typed provider failures.
- Bounded orchestration that executes only validated allowlisted tools and resolves model-selected identifiers from accumulated server-produced tool results.
- Additive persistence migration and pgTAP coverage for source/chunk approval and visibility, consent and retention, ownership, RLS, evidence eligibility, and disabled-by-default storage.

## Verification

Passed:

- `./node_modules/.bin/vitest run src/lib/chat/ src/app/api/chat/route.test.ts` - 8 files, 128 tests.
- `npm run lint` and `npm run build` completed without reported errors.
- `./node_modules/.bin/tsc --noEmit` remains blocked by pre-existing workspace errors in `src/app/api/products/route.test.ts` and `src/lib/products/filter-utils.test.ts`; no Plan 04 errors remain.
- `GIT_MASTER=1 git diff --check` - clean.

Blocked or unavailable:

- TypeScript LSP diagnostics are unavailable because the server is not installed and installation was previously declined.
- `supabase/plan00-local/run-clean-reset.sh` could not start the local harness because Docker is unavailable at `/var/run/docker.sock`. No remote Supabase operation was attempted.
- The `supabase` CLI is unavailable in this environment, so the pgTAP file was not executed. The migration was statically corrected to the reserved Plan 04 prefix and its composite foreign-key/role-integrity constraints were reviewed.
- Live DeepSeek smoke is blocked because `DEEPSEEK_API_KEY` is absent. Provider tests use local mocked responses only.

## Rollout and integration prerequisites

- Keep rollout disabled until `CHAT_ENABLED=true`, a server-only key is provisioned, approved public retrieval/tool adapters are connected, and the local migration suite passes in a disposable Docker-backed database.
- The production chat UI, entry point, responsive/a11y states, and canonical product-card renderer integration remain outstanding against the authoritative Plan 04 ownership. Plan 08 owns shared translations/global environment schema/generated types and production feature-flag wiring; it must not be treated as completion of the missing Plan 04 UI without an explicit scope amendment.
- Plan 03, Plan 05, and Plan 06 must provide the authorized customer-memory, recommendation, and vision ports before those scopes are enabled. Public chat must not expose private customer data, room photos, hidden catalog data, or model-authored commercial facts.
- Persistence activation remains consent-backed and unlinked from the public route. Do not enable conversation storage by default.
