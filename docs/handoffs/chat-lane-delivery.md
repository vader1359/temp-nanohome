# Chat lane delivery handoff

## Delivered commits

| Commit | Slice |
| --- | --- |
| `9c8e527` | Accessible native product and media result carousels |
| `a2d28a9` | Versioned brand-voice contract |
| `d525178` | Grounded public-advisor prompt integration |
| `3f6d2a3` | Default-off persistence, handoff, attachment, and vision capability contracts |
| `6124bc8` | Foundation capability activation handoff |
| `7162e65` | Removed the global consent banner gate |
| `acbe6f5` | Removed the public Chat API consent prerequisite |
| `9f2d51d` | Opened the public Chat assistant without a consent gate |
| `64d0507` | Removed the obsolete Chat-only consent adapter |

## Safe behavior delivered

- Structured chat products and media render as capped, native horizontal scroll-snap carousels with localized controls, actual-overflow detection, reduced-motion behavior, and safe image fallbacks.
- The DeepSeek request remains text-only, uses temperature `0`, and now includes `public-advisor-v3`: warm, concise, grounded, locale-aware tone with Vietnamese `bạn` guidance and a strict no-humor topic list.
- Persistence, Advisor handoff, attachment, and visual-analysis contracts are strict and opaque-reference-only. Every registry capability remains disabled, and the adapter always returns a typed unavailable result without network, storage, database, or provider activity.
- The locale layout no longer renders a global consent banner or launcher. Public Chat opens and reaches its existing guarded fallback/orchestration flow without fetching customer context or requiring `aiProcessing` consent. Same-origin, bounded parsing, schema validation, rate limits, policy filtering, grounding, and safe fallback remain in place.
- No migrations, RLS changes, storage, environment changes, live provider calls, credentials, deployment, or shared identity/payment work were performed.

## Verification

- `pnpm vitest run --silent`: passed — 149 test files, 915 tests.
- `pnpm tsc --noEmit`: passed.
- `pnpm lint`: passed with no errors; pre-existing warnings remain outside this lane.
- `git diff --check`: passed after each slice.
- TypeScript LSP diagnostics are unavailable because the TypeScript server is not installed and installation was previously declined.
- `pnpm build` completed its TypeScript phase but did not finish in the allotted command execution window. Treat the production build as pending environment investigation.
- Live browser and HTTP QA remain blocked: the local Next server retries while compiling `/[locale]`, then exits before serving `/vi`. Component and route tests cover the corrected behavior, but no browser PASS is claimed.

## Foundation deltas and rollback

- Activation ownership, required prerequisites, opaque payload examples, and blocked production work are in `docs/handoffs/chat-foundation-capabilities.md`.
- Foundation must wire a server-owned client/IP rate limiter into `createLiveServerChatDependencies` before enabling `CHAT_ENABLED`. The current public route only applies a limiter when its dependency is supplied; do not enable the live provider without this control.
- The v3 ordinary account-settings/personalization-policy migration remains Foundation-owned. This lane removed only the global banner and Chat prerequisite; it did not change consent data, tracking activation, retention, access control, or customer-data boundaries.
- Every delivered commit is independently revertible. Keep all capability flags disabled until Foundation implements approved server-only adapters, migrations/RLS, retention/deletion, upload controls, secrets, and activation tests.
