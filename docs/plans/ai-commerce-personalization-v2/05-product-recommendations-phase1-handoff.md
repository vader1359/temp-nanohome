# Plan 05 Phase 1 handoff

## Delivered

- Added `recommendPdpProducts` in `src/lib/recommendations/service.ts`.
- Filters candidates through `isRecommendationEligible`, excludes the current variant, collapses duplicate products, and applies stable score plus variant-ID tie breaking.
- Only candidates within the deterministic 25% price band receive `similar_price_band`; unsupported relationships are excluded rather than mislabeled.
- Returns the frozen recommendation response shape with `pdp-deterministic-v1`, canonical variant IDs, approved reason codes, generated timestamp, and explicit empty fallback tier.
- Added `PdpRecommendationService` as the frozen `RecommendationPort` adapter for PDP requests; non-PDP placements remain explicitly unsupported.
- Added a local typed `catalog_eligibility` view contract and parsed catalog adapter without modifying generated database types.
- Added `loadPdpRecommendations` to enforce eligibility for both the context and hydrated render candidates, fetch only selected canonical IDs, and preserve rank after unordered database hydration.
- Updated the PDP to use the typed loader while retaining existing carousel styling, removing mock fallbacks, returning null for empty carousels, and using canonical variant IDs for cards.
- Added Given/When/Then unit coverage for hard eligibility, deterministic ties, product-family dedupe, truthful reasons, port adaptation, empty fallback behavior, and ordered eligible hydration.

## Deliberate Phase 1 limits

No text, vision, behavior, learning-to-rank, merchandising tables, non-PDP placements, or UI redesign was added. The existing database view is sufficient; no migration was required.

## Verification

- `corepack pnpm vitest run src/lib/recommendations/service.test.ts src/lib/catalog/eligibility.test.ts` passes (11 tests).
- Focused ESLint passes for all changed recommendation, PDP, query, and carousel files.
- Repository-wide `corepack pnpm exec tsc --noEmit` remains blocked by pre-existing generated database type drift in unrelated checkout, AMIS, Instagram, query, and API files; no changed recommendation or PDP file appears in its diagnostics.
