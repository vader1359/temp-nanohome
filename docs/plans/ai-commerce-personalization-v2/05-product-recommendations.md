# Worktree 05 — Explainable Product Recommendation Service

Branch: `codex/product-recommendations-v2`

Base: exact `<FOUNDATION_SHA>` from Plan 01

Status: planning only

## Outcome

Replace static/mock PDP recommendations with one placement-aware service that returns eligible canonical variant IDs, stable reason codes, and attribution metadata.

The first production ranker is deterministic and merchandiser-controllable. Sparse premium-order behavior is not enough to justify collaborative filtering or learning-to-rank at launch.

## Keep four questions distinct

1. **Related:** products similar to the current item.
2. **Complementary:** products that belong with the current item or room.
3. **Personalized:** products fitting this customer's explicit/consented context.
4. **Visually similar:** products whose canonical images resemble an item/crop.

One service may combine these signals, but it must record which strategy produced each candidate. “Looks similar” must not be presented as “will fit your room.”

## Hard eligibility before ranking

Every candidate passes `CatalogEligibility` from Plan 00 before scoring and again before response rendering:

- product, variant, brand, and publication state are visible;
- canonical image and URL are usable;
- commercial mode is allowed for the placement;
- stock/freshness policy is satisfied;
- current/context items are excluded where required;
- hidden special cases are consistently removed;
- locale fallback is valid;
- no duplicate product/color/view floods the result.

The recommender cannot resurrect an item excluded by catalog policy. Availability is a hard filter or explicitly labelled fallback, never just a weak score.

## Placement contracts

### PDP

Input: exactly one current variant. Output should balance similar alternatives and complementary products. Exclude the current item and suppress near-duplicate variants unless comparison is intentional.

### Cart

Input: selected cart variants. Prefer complementary categories and avoid recommending the same product family already present. Never alter the cart automatically.

### Home

Input: no required item; optional explicit preferences/customer context through Plan 07. Always provide a curated default when personalization is unavailable.

### Chat

Input: one anchored product or explicit filters/room context. Return reason codes and IDs; Plan 04 renders/explains them.

### Room

Input: validated `roomSceneId`. Use structured room attributes and optional visual candidates from Plan 06. A room photo alone does not prove dimensions, compatibility, or availability.

## Candidate-generation ladder

Run cheap, reliable sources first and stop when enough high-quality diverse candidates exist.

### Tier 0 — merchandising

- explicit pin/ban/boost rules;
- curated related and complementary links;
- campaign/collection ordering;
- business exclusions and diversity requirements;
- effective dates and placements.

Pins still pass eligibility. A merchandiser cannot pin an unpublished or commercially ineligible variant.

### Tier 1 — structured catalog similarity

Use normalized catalog features:

- subcategory/category and complementary-category map;
- intended room/use case;
- designer, brand, collection;
- style tags, materials, colors, finish;
- fixed-price band or contact-price compatibility;
- dimensions only when actual structured values exist;
- premium/new/featured flags approved for ranking.

This is the launch baseline because it is explainable and works without behavioral history.

### Tier 2 — content similarity

Use multilingual text embeddings only after an offline benchmark proves improvement over structured matching. Embed approved canonical product/variant text, store model/version/content hash, and never compare vectors from incompatible versions.

### Tier 3 — visual similarity

Consume `VisualSimilarityPort` from Plan 06. Use it for “similar appearance” candidates and as one signal in room recommendations. Apply category, metadata, business, stock, and diversity reranking after vector retrieval.

### Tier 4 — consented behavior

Add view/cart/order pair signals only after Plan 01 events and Plan 02 order attribution are reliable. Require minimum support, time decay, bot/internal-traffic filtering, privacy thresholds, and deterministic fallback. Sparse pairs receive no behavioral boost.

### Tier 5 — learning-to-rank

Deferred until there is sufficient randomized/attributed traffic, stable labels, holdouts, monitoring, and an explainable baseline. Do not train on whichever items the existing UI happened to expose and call that unbiased relevance.

## Versioned feature representation

Build one `variant_recommendation_features` projection containing only canonical, normalized values:

- variant/product IDs and product-family key;
- category/subcategory and room IDs;
- brand/designer/collection IDs;
- allowlisted style/material/color/finish tags;
- price mode and price-band ID;
- width/depth/height where verified;
- availability/visibility flags and source freshness;
- canonical image ID/hash;
- feature schema/version and source update time.

Do not parse product prose on every request. Rebuild affected features idempotently when catalog inputs change.

## Scoring and reason codes

Use a versioned, placement-specific weighted score. An illustrative PDP baseline—not final weights—is:

```text
score =
  merchandising_pin_or_boost
  + subcategory_match
  + room/use_case_match
  + complementary_category_score
  + style_material_palette_overlap
  + designer_brand_collection_affinity
  + compatible_price_band
  + optional_text_similarity
  + optional_visual_similarity
  + optional_consented_behavior
  - duplicate_family_penalty
  - overrepresented_brand/category_penalty
```

Weights are configuration with an `algorithm_version`, not scattered constants. Candidate sources must normalize their scores before combination.

Each returned item has one truthful customer-facing reason selected from approved codes, for example:

- `same_collection`;
- `same_designer`;
- `similar_material`;
- `similar_style`;
- `similar_palette`;
- `similar_price_band`;
- `works_in_same_room`;
- `complements_current_item`;
- `visually_similar`;
- `matches_explicit_preference`;
- `previously_discussed`;
- `popular_in_category`;
- `merchandiser_selected`.

Do not claim “chosen for you” unless an approved customer signal actually affected the result.

## Diversity and deduplication

After scoring:

- collapse same product/near-identical color variants according to placement;
- limit per brand, designer, collection, and subcategory;
- intentionally mix alternatives and complements where the placement calls for both;
- ensure minimum image/metadata quality;
- backfill from the next fallback tier when filters reduce coverage;
- keep deterministic tie-breaking by canonical ID or configured display order.

## Service contract

Consume the frozen Plan 00 request/response DTO:

```ts
interface RecommendationPort {
  recommend(input: RecommendationRequest & {
    customerContextKey?: string;
    limit?: number;
  }): Promise<RecommendationResponse>;
}
```

The server resolves any customer key and room ownership. Clients cannot submit arbitrary preference weights, behavioral IDs, scores, stock, or algorithm versions.

Internal debug output for authorized merchandisers may include candidate sources, component scores, filtered reasons, and rank transitions. Customer responses expose only the approved reason code.

## Proposed data model

Use the reserved recommendation migration lane.

### `recommendation_overrides`

- placement, context product/category/room selector;
- candidate variant ID;
- action: pin, boost, ban, complement;
- priority/weight, dates, locale/audience where approved;
- author, approval, reason, version.

### `variant_recommendation_features`

- normalized fields described above;
- feature version and freshness;
- deterministic rebuild status.

### `variant_text_embeddings`

- variant ID, locale, source hash;
- model/provider/version/dimensions;
- vector and generation state;
- active/retired timestamps.

### `variant_similarity_neighbors`

- source/target variant IDs;
- strategy (`structured`, `text`, `visual`);
- algorithm/model version;
- bounded internal score and generated/expiry timestamps.

Precompute only if catalog size/latency measurements justify it.

### `variant_pair_signals`

- source/target IDs, signal type, support, decayed weight, window/version;
- no raw user identity;
- minimum-support visibility.

### `recommendation_requests`

Store a privacy-minimized attribution ledger:

- request ID, placement, algorithm/fallback version;
- context entity IDs;
- returned item IDs/ranks/reason codes;
- anonymous/auth subject reference only when consent permits;
- generated/expiry timestamps;
- no room image or raw CRM/customer-memory payload.

Events reference the request ID so impression, click, cart, and order attribution remain consistent.

## Caching

- cache non-personalized PDP/cart candidates by context IDs, locale, algorithm version, catalog feature version, and availability policy;
- resolve price, visibility, and stock again before rendering;
- use private/no shared cache for customer-specific results;
- room results include scene/version and owner authorization;
- invalidate or change version on override/catalog/model changes;
- never cache one authenticated customer's result into a public response.

## Offline evaluation

Create a merchandiser-labelled golden set:

- representative hero products per category/brand/designer/price mode;
- expected acceptable alternatives and complements;
- explicit unacceptable pairs;
- same-room, style, material, palette, and price cases;
- visually similar cases supplied by Plan 06;
- hidden, stale, contact-price, sparse-metadata, and no-result cases;
- Vietnamese/English/Korean catalog variants.

Metrics:

- Recall@K and nDCG@K against acceptable sets;
- unacceptable/category-leakage rate;
- coverage and no-result rate;
- current/hidden/stale item violation count;
- duplicate/diversity metrics;
- reason-code correctness;
- latency and cache hit rate;
- comparison against curated and structured-only baselines.

Visual/text/behavior signals ship only if they improve an approved baseline without increasing hard-filter violations.

## Online measurement

After Plan 01 consent and event reliability:

- eligible requests, impressions, clicks, product opens, add-to-cart, checkout, and orders;
- request/algorithm/placement/rank attribution;
- guardrails: bounce, no-result, hide/reset, out-of-stock clicks, latency, complaint/handoff rate;
- deterministic assignment and persistent holdout;
- do not optimize only CTR at the expense of relevance or premium merchandising goals.

Low traffic means experiments may take a long time. Merchandiser evaluation and qualitative customer-service feedback remain primary evidence until sample sizes are credible.

## PDP integration

The current product-detail recommended/related sections should consume the service while preserving their existing visual design. Required states:

- server-rendered or stable loading layout;
- fewer valid results rather than ineligible filler;
- deterministic curated fallback;
- hidden section only when no approved fallback exists;
- instrumentation tied to request ID;
- ProductCard receives current canonical record, not a stale recommendation snapshot.

## Implementation phases

### Phase 0 — contract and benchmark

- freeze placement rules, reason codes, feature schema, and override workflow;
- build golden cases and capture current curated/mock baseline;
- map incomplete catalog fields and assign content owners.

### Phase 1 — deterministic recommender

- build feature projection and structured/merchandising candidates;
- implement eligibility, scoring, diversity, fallback, service contract, attribution, and PDP integration;
- launch in shadow/internal mode.

### Phase 2 — text similarity

- benchmark multilingual embedding candidates on real catalog data;
- add versioned async embedding/backfill only if approved;
- compare hybrid against structured-only holdout.

### Phase 3 — vision integration

- consume Plan 06 visual neighbors through the frozen port;
- distinguish object similarity from room-fit ranking;
- rerun all eligibility/business filters.

### Phase 4 — personalization/behavior

- accept explicit preferences and safe customer memory through Plan 07 context;
- add pair/affinity signals only after support thresholds;
- keep deterministic fallback and independent feature flags.

## File ownership

This worktree owns new recommendation namespaces, feature/override/request migrations, jobs, ranker, debug fixtures, service route/port implementation, and recommendation-section behavior.

It must not own Plan 01 event collection, Plan 03 CRM sync, Plan 06 image embeddings, Plan 07 preference UI/context resolver, shared ProductCard redesign, generated types, global env/translations/providers/schedules, or lockfile. Handoff shared changes to Plan 08.

## Test matrix

- eligibility for every catalog/commercial state;
- placement request schemas and ownership;
- merchandising pin/ban/expiry conflicts;
- structured scoring, normalization, deterministic ties, diversity, duplicate families, and fallback tiers;
- reason code matches the actual winning signal;
- catalog update/feature rebuild and cache invalidation;
- embedding model/dimension/version isolation and job idempotency;
- sparse/low-support behavior ignored;
- public vs customer cache isolation;
- request/impression/click/order attribution;
- PDP SSR/loading/responsive/accessibility behavior;
- downstream visual/personalization outage fallback;
- full golden-set regression.

## Feature flags and rollback

- `RECOMMENDATIONS_ENABLED`;
- placement-specific flags;
- `RECOMMENDATION_ALGORITHM_VERSION`;
- `RECOMMENDATION_TEXT_SIGNAL_ENABLED`;
- `RECOMMENDATION_VISUAL_SIGNAL_ENABLED`;
- `RECOMMENDATION_BEHAVIOR_SIGNAL_ENABLED`;
- override and curated-baseline modes.

Rollback selects the previous algorithm/feature version or curated/static baseline. It must not require deleting request/attribution history.

## Definition of done

- PDP receives real deterministic recommendations with canonical IDs and truthful reasons;
- all placements share one eligibility and versioned ranking contract;
- sparse data never forces collaborative or learned ranking;
- visual similarity, room fit, complements, and personalization remain distinguishable;
- every result can be explained/debugged and re-evaluated offline;
- the service falls back safely when embeddings, behavior, vision, customer memory, or jobs are unavailable.

## References

- [Supabase semantic search](https://supabase.com/docs/guides/ai/semantic-search)
- [Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)
- [Supabase Queues](https://supabase.com/docs/guides/queues)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
