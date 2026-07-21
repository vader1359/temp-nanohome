# Plan 06 Handoff, Vision Intelligence Foundation

## Boundary

- Worktree: `codex/vision-intelligence` at `/home/iant1359/develop/temp-nanohome-ai-06-vision-intelligence`.
- Local-only foundation. No external provider was selected or called, no remote mutation occurred, and no remote Supabase migration, deployment, push, merge, account configuration, generated type update, lockfile update, shared contract update, translation update, or product-code change occurred.
- The Plan 06 artifacts are uncommitted in this worktree. Record the final source and head SHAs only after the intended local commit exists.

## Owned artifacts and contracts

- `src/lib/vision/contracts.ts` defines strict provider-output and room-scene parsing, customer measurement overrides, and provider/model/version/dimension vector compatibility checks.
- `src/lib/vision/privacy.ts` keeps processing consent separate from retention consent. `buildDeepSeekTextPayload` exports only selected structured scene fields and a provider-text-presence boolean. It excludes image bytes, URLs, vectors, and raw provider responses.
- `src/lib/vision/retrieval.ts` returns only canonical variant IDs and reason codes after eligibility, fresh-stock, compatibility, and duplicate filtering.
  - `visually_similar` means image-level visual resemblance from compatible embeddings.
  - `room_fit` requires confirmed scene, customer measurements, or room signals. A nearest visual match alone is not a room-fit claim.
- `src/lib/vision/state.ts` supplies the local analysis-state transition contract.
- `src/lib/vision/config.ts` defaults `uploadEnabled`, `roomAnalysisEnabled`, `visualSimilarityEnabled`, and `evaluationStorageEnabled` to `false`.
- `src/lib/vision/fixtures.ts` is synthetic only. It contains no customer image or provider output.
- `src/lib/vision/index.ts` is the local export boundary.
- `supabase/migrations/20260721070000_plan06_vision_persistence.sql` adds the private `room-photos` bucket, owner-scoped request/scene/crop tables, catalog-only embedding storage, RLS, disabled database feature defaults, and service-role-only bounded request deletion. It does not persist raw provider responses or image bytes in scenes, and catalog embeddings have no customer owner.
- `supabase/tests/vision_persistence_test.sql` checks RLS, denied direct deletion, private storage, service-role deletion, and separation of customer deletion from catalog embeddings and orders.
- `supabase/plan00-local/run-clean-reset.sh` copies and runs the vision pgTAP suite in the isolated local harness.

The only existing shared interface referenced by this foundation is `RecommendationPort` in `src/lib/contracts/ports.ts`. No `RoomVisionProvider` or `ImageEmbeddingProvider` adapter exists yet. No upload route, provider job, customer UI, or external-model configuration is included.

## Privacy and deletion rules

- Image processing and image retention require separate consent values.
- Upload, analysis, visual similarity, and evaluation retention are disabled by default in both TypeScript and SQL defaults.
- Bucket access is private and owner-scoped. Authenticated users have no direct delete privilege for room photos, requests, or crops.
- `public.delete_vision_request(uuid)` is service-role-only. It deletes request-scoped private objects and the request record, whose cascades remove customer-specific scene and crop rows. It does not delete catalog embeddings or orders.
- Any future text model receives the safe structured payload only. It must not receive images, signed URLs, vectors, or raw provider data.

## Verification artifacts and commands

- Synthetic unit coverage: `src/lib/vision/vision.test.ts`.
- Database/RLS coverage: `supabase/tests/vision_persistence_test.sql`.
- Local harness: `supabase/plan00-local/run-clean-reset.sh`.
- Relevant commands:

```bash
corepack pnpm exec vitest run src/lib/vision/vision.test.ts
supabase/plan00-local/run-clean-reset.sh
git diff --check
```

Observed local results:

- `corepack pnpm exec vitest run src/lib/vision/vision.test.ts` passed, 1 file and 22 tests.
- `git diff --check` passed.
- `supabase/plan00-local/run-clean-reset.sh` did not run the pgTAP suites because local Supabase is not running.

## Known blocker

Direct local Supabase verification also remains blocked before the Plan 06 pgTAP test can run when the historical migration chain lacks `public.variants`. The known symptom is `SQLSTATE 42P01`. Local Supabase is unavailable for this worktree's direct migration path. The isolated Plan 00 harness is the intended local test entry point, but integration must rerun the suite against a complete historical baseline and a clean reset.

## Deferred production launch gate

Keep all vision flags and uploads disabled until an approved provider and model are selected, then record and approve:

1. retention, training, subprocessor, and data-region terms, plus account-level settings that enforce them;
2. provider authentication, quotas, concurrency, cost caps, latency budgets, error handling, and model/version lifecycle;
3. benchmarked quality, confidence, schema-validity, retrieval, privacy, and deletion thresholds against approved synthetic and separately consented evaluation data;
4. private storage, queue, provider-account, alerting, and operational-owner configuration;
5. clean-reset and existing-environment migration evidence, RLS cross-user isolation, deletion reconciliation, and rollback drills.

Until those gates pass, use metadata-only recommendations and text chat. Do not expose an upload surface, invoke a provider, retain evaluation images, or claim a product physically fits from a photo.
