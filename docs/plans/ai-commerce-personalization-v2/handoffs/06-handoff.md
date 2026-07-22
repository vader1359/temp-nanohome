# Plan 06 Handoff, Vision Intelligence Foundation

## Boundary

- Worktree: `codex/vision-intelligence-v2` at `/home/iant1359/develop/temp-nanohome-ai-06-vision-intelligence`.
- Local-only foundation. No external provider was selected or called, no remote mutation occurred, and no remote Supabase migration, deployment, push, merge, account configuration, generated type update, lockfile update, shared contract update, translation update, or product-code change occurred.
- Plan 00's `CatalogEligibility` contract is a dependency. Retrieval uses its recommendation and visual-match eligibility plus fresh-stock checks.
- Scoped local commits: `04e677e`, `6e69440`, `171e8d3`, `826120f`, and `1a52499`.
- Final local head SHA: `2385526` (`Record final vision commit handoff`).

## Implemented local artifacts

- `src/lib/vision/contracts.ts` validates strict provider output, room scenes, customer measurement overrides, and provider/model/version/dimension vector compatibility.
- `src/lib/vision/lifecycle.ts` defines local upload intent and validation, analysis lifecycle transitions, redacted failures, corrections, and deletion scope.
- `src/lib/vision/provider.ts` provides synthetic local seams for `RoomVisionProvider` and `ImageEmbeddingProvider`, composed by `VisionProvider`. No external adapter, credentials, or provider call exists.
- `src/lib/vision/jobs.ts` provides an in-memory job boundary, exported through `src/lib/vision/index.ts`. Nested request and idempotency-key maps prevent delimiter-based identity collisions, reject mismatched duplicate attributes, and return the prior outcome for exact duplicate delivery.
- `src/lib/vision/service.ts` orchestrates local visual and room-fit retrieval. Its result omits raw request references, data URIs, signed URLs, provider paths, embeddings, and provider details.
- `src/lib/vision/retrieval.ts` returns canonical variant IDs and reason codes after vector compatibility, eligibility, fresh-stock, and duplicate-image filtering. `room_fit` needs confirmed scene, explicit measurements, or room signals.
- `src/lib/vision/privacy.ts` keeps processing consent separate from retention consent. Its text payload excludes image bytes, URLs, vectors, and raw provider responses.
- `src/lib/vision/config.ts` defaults `uploadEnabled`, `roomAnalysisEnabled`, `visualSimilarityEnabled`, and `evaluationStorageEnabled` to `false`.
- `src/lib/vision/fixtures.ts` remains synthetic only. `src/lib/vision/index.ts` is the local export boundary.
- `src/lib/vision/index.ts` publicly exports lifecycle functions/types and local retrieval orchestration alongside the provider/job boundaries.
- `supabase/migrations/20260721070000_plan06_vision_persistence.sql` is unchanged. It defines the intended private storage, owner-scoped persistence, RLS, disabled SQL feature defaults, and bounded service-role deletion model.

## Coverage and observed verification

- Focused unit coverage: `lifecycle.test.ts`, `provider-jobs.test.ts`, `service.test.ts`, and `vision.test.ts`.
- `corepack pnpm exec vitest run src/lib/vision` passed: 4 files, 46 tests.
- `supabase/tests/vision_persistence_test.sql` declares `plan(52)` and covers 52 assertions. Its SQL harness has not run.
- Docker is unavailable in this environment, so the local Supabase clean-reset harness could not be exercised.
- `corepack pnpm exec tsc --noEmit` has unrelated existing errors in `src/app/api/products/route.test.ts` and `src/lib/products/filter-utils.test.ts`.
- `corepack pnpm lint` has unrelated existing errors, including `no-explicit-any` and restricted server-only imports in cart and Instagram test files.
- TypeScript LSP is unavailable, so no TypeScript LSP diagnostics were run.

## Unverified persistence gate

The migration itself was not changed or executed. The local lifecycle path (`vision/{owner}/{scene}/upload`) and SQL request path (`{owner}/{request}/...`) are intentionally not integrated until the server-issued request identity is finalized. Storage path, grants, and schema integration remain unproven in a complete local or remote Supabase environment. Treat successful clean-reset migration, pgTAP completion, RLS cross-user isolation, deletion reconciliation, and rollback evidence as required production gates.

## Deferred production launch gate

Keep all vision flags and uploads disabled until an approved provider and model are selected, then record and approve:

1. Retention, training, subprocessor, and data-region terms, plus account-level settings that enforce them.
2. Provider authentication, quotas, concurrency, cost caps, latency budgets, error handling, and model/version lifecycle.
3. Benchmarked quality, confidence, schema-validity, retrieval, privacy, and deletion thresholds against approved synthetic and separately consented evaluation data.
4. Private storage, queue, provider-account, alerting, and operational-owner configuration.
5. Clean-reset and existing-environment migration evidence, RLS cross-user isolation, deletion reconciliation, and rollback drills.

Until those gates pass, use metadata-only recommendations and text chat. Do not expose an upload surface, invoke a provider, retain evaluation images, connect a remote service, add secrets, or claim a product physically fits from a photo.
