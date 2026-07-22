# Worktree 07 — Customer Experience Personalization

Branch: `codex/customer-personalization-v2`

Base: a recorded integration base containing the public contracts from Worktrees 03 and 05, both originally based on `<FOUNDATION_SHA>`

Status: planning only; do not start until `CustomerMemoryPort` and `RecommendationPort` contracts are stable

## Outcome

Personalize useful parts of the website through explicit customer choices, recent session utility, verified customer memory, and later consented behavior—while always preserving a strong curated default.

Personalization selects approved content/products/modules. It does not let a language model generate arbitrary layouts, prices, promotions, stock claims, or private customer facts.

## Product principles

- help before persuasion;
- explicit preferences are more trustworthy than inferred ones;
- curated/default experience must remain complete for every user;
- use the minimum context necessary for each placement;
- explain and let customers edit/reset meaningful preferences;
- never infer demographics, wealth, family status, health, religion, or other sensitive traits;
- do not expose internal CRM notes or make personalization feel like surveillance;
- low traffic and rare orders require deterministic rules before machine learning;
- opt-out, AMIS outage, or missing history must degrade cleanly.

## Experience ladder

### Level 0 — curated default

Available to everyone with no personalization consent:

- existing editorial hero/modules;
- merchandiser-selected featured products;
- category/room/brand navigation;
- deterministic PDP related/complementary items;
- locale and essential accessibility preferences.

This is the benchmark and permanent fallback, not a temporary empty state.

### Level 1 — session utility

With essential/appropriate first-party context:

- recently viewed on this browser/session;
- resume last catalog filters or comparison;
- keep cart and selected lines;
- continue a non-sensitive room/project draft only under its own consent.

Session utility should not imply a durable customer profile.

### Level 2 — explicit preferences

With personalization consent:

- preferred rooms/categories;
- preferred brands/designers/collections;
- style, material, and palette tags;
- fixed-price budget band or `contact price acceptable` preference;
- desired service/contact channel where approved;
- measured room/project constraints supplied by the customer;
- exclusions such as “do not show this brand/style.”

Explicit values have source, update time, scope, and delete/reset controls.

### Level 3 — verified customer memory

Use Plan 03's bounded `CustomerMemory` only after authentication, verified AMIS link, purpose consent, and freshness checks:

- previously purchased canonical products;
- staff-approved discussed product IDs;
- approved room/project stage and preferences;
- customer-visible summary.

Raw AMIS Customers/Contacts/SaleOrders, notes, calls, consultation cards, addresses, debt, and internal comments never enter the personalization context.

### Level 4 — behavior-derived affinity

Only after Plan 01 events are reliable and support thresholds are met:

- decayed affinity for category, room, brand, designer, style, material, and price band;
- suppression of one-off/noisy behavior;
- minimum event count and distinct-session requirements;
- exclusion of bots, staff, QA, accidental clicks, withdrawn subjects, and stale history.

Explicit preferences override contradictory inferred affinity. Inference never silently overwrites stored explicit values.

### Level 5 — experiments/adaptive journeys

Deferred until traffic supports credible experiments. Require deterministic assignment, holdout, guardrails, approval, and rollback. No autonomous generative page composition.

## Initial placements

### Homepage

- `Continue shopping` from recently viewed;
- `For your living room` from explicit room preference;
- `From designers/brands you follow` from explicit preference;
- `Continue your project` from a confirmed room scene/project;
- one recommendation rail backed by Plan 05;
- editorial/default modules fill every unavailable personalized slot.

Do not rewrite the whole homepage per person. Limit personalized modules and keep navigation predictable.

### PDP

- use current item plus explicit/customer context to choose among recommendation strategies;
- show a truthful reason such as same designer, complements a prior purchase, or matches the selected room;
- never reveal a private prior purchase in a shared/public session without authenticated context.

### Catalog/search

- optional preference shortcuts and default filters;
- do not silently hide the full catalog;
- provide `clear personalized filters` and display active reasons.

### Chatbot

- supply only the bounded context necessary for the question through the authenticated port;
- let the customer ask to use or ignore prior preferences/history;
- never inject raw event history or raw CRM records into prompts.

### Cart/checkout

- recommendations may use selected cart items;
- delivery/contact defaults may use explicit saved choices through a separate approved profile contract;
- personalization cannot change price, stock, tax, order state, payment method, or refund behavior.

## Customer context resolver

Build one server-only resolver. Feature components do not join identity, events, CRM snapshots, and preferences themselves.

```ts
type PersonalizationContext = {
  contextVersion: string;
  mode: "default" | "session" | "explicit" | "customer_memory" | "hybrid";
  locale: string;
  explicit: PreferenceFeature[];
  recent: RecentEntity[];
  affinities: AffinityFeature[];
  customerMemory?: CustomerMemory;
  roomSceneIds: string[];
  exclusions: PreferenceFeature[];
  explanationKeys: string[];
};
```

Resolver order:

1. server-resolve visitor/session/auth identity;
2. read current consent and feature flags;
3. load explicit preferences/exclusions;
4. load bounded recent utility;
5. load only sufficiently supported affinities;
6. request `CustomerMemoryPort` only when authenticated and allowed;
7. reference only owner-scoped confirmed room scenes;
8. resolve conflicts with explicit > customer-approved memory > repeated behavior > curated default;
9. return a bounded allowlisted context and explanation keys;
10. never serialize HttpOnly identity, source CRM IDs, or raw histories to the client.

Each placement requests only needed feature categories so homepage rendering does not automatically fetch CRM or room context.

## Identity and merge behavior

- anonymous recent items remain browser/session scoped;
- on login, merge only consented events/preferences through Plan 01's audited link;
- do not merge if the device may be shared and the customer chooses not to;
- logout clears private server-rendered modules and prevents back/edge cache leakage;
- account switch invalidates personalized caches;
- AMIS customer link remains a separate verified relation from website visitor merge;
- unlink/withdrawal removes customer-memory influence immediately without deleting legally required orders.

## Preference model

### `customer_preferences`

- subject scope (visitor/user), feature type/key/value;
- source: explicit customer, staff-approved brief, import, or system default;
- confidence only for inferred values;
- purpose/consent version;
- created/updated/expiry/deleted timestamps;
- provenance and supersession link.

Store IDs/tags from allowlists, not arbitrary prose. A staff-entered preference must be visibly distinguishable from a customer-confirmed preference and should expire/review.

### `customer_recent_entities`

- subject, entity type/ID, last interaction, bounded count;
- deterministic upsert/eviction;
- short retention;
- no product title/image snapshot needed.

### `customer_affinities`

- feature type/key, score/support/distinct sessions;
- source window and algorithm version;
- last evidence/decay/update times;
- suppression/expiry state;
- no raw event list.

### `personalization_decisions`

- decision ID, placement, context/algorithm/version, selected module/strategy IDs;
- explanation keys and fallback tier;
- consented subject reference and expiry;
- no raw CRM memory, room scene, image, free text, or event history.

### Optional project model

`customer_room_projects` may connect customer-confirmed room scenes, explicit measurements, intended categories, and saved recommendations. It requires owner RLS, explicit naming/edit/delete UX, and bounded image/scene retention. Do not make room-photo use permanent by hiding it inside generic personalization consent.

## Affinity calculation

Illustrative deterministic design:

```text
affinity(feature) = sum(event_weight * time_decay * source_quality)
```

Rules:

- product view < repeated view < explicit save < cart < verified order;
- recommendation impressions without interaction do not create preference;
- one burst/session has a cap;
- negative/reset/exclusion feedback dominates positive inference;
- minimum count and distinct-session support before exposure;
- decay toward zero and expire old signals;
- compute server-side in idempotent batches;
- version weights and retain a curated fallback.

Given nanoHome's low order frequency, do not wait for order data: explicit preferences, staff-approved context, room projects, and catalog features provide the useful first release.

## Module selection

Use a fixed approved module inventory. For each slot:

1. enumerate eligible curated and personalized strategies;
2. apply consent/access/context requirements;
3. request Plan 05 recommendations where products are needed;
4. apply content/product eligibility and diversity;
5. choose by deterministic priority/experiment assignment;
6. store minimal decision attribution;
7. render current canonical content/products;
8. fall back to curated module if any dependency is missing.

The model is not allowed to author arbitrary headings, discounts, urgency, layouts, or product claims. Copy comes from approved localized templates keyed by explanation/strategy code.

## Caching and rendering

- curated modules may use normal shared caching;
- authenticated/customer-memory pages use private/no shared caching;
- session-personalized responses vary by opaque server context, never client-supplied user ID;
- do not place customer-specific HTML in a public CDN cache;
- canonical prices/stock/visibility re-resolve at render time;
- logout/account switch invalidates or bypasses private cache;
- use stable server HTML/loading layout to avoid flashes of another/default experience and hydration mismatch.

## Transparency and controls

Provide a customer-facing preference center:

- view/edit explicit room, category, style, material, brand, designer, and budget preferences;
- see whether prior nanoHome history is connected at a high level;
- disable/reset personalization;
- remove a recent item or saved room project;
- disconnect AMIS-derived customer memory;
- delete room-photo/scene data through Plan 06;
- understand simple labels such as `Because you selected living room` or `Complements an item you viewed`.

Avoid overly specific explanations that reveal internal notes or surprise the customer. `Based on prior consultation` is allowed only when the staff-approved brief and customer-facing wording support it.

## Privacy and policy

- purpose consent gates behavioral/context collection and use;
- essential cart/order state is not repurposed automatically for marketing/personalization;
- no sensitive-trait inference or lookalike profiling;
- no raw messages/notes/photos in general event or decision ledgers;
- derived affinity is deleted/restricted on withdrawal and can be rebuilt only from still-allowed data;
- retention differs for recent utility, preferences, affinities, decisions, orders, and room projects;
- internal staff/customer-service access is separate and audited;
- customer correction and deletion paths are operationally tested.

## Measurement

Primary product metrics:

- module eligible/render/impression/click/product-open/add-to-cart/order;
- recommendation request/algorithm/rank attribution;
- preference completion/edit/reset/disable rate;
- recently viewed resume rate;
- customer-memory connection/correction/disconnect rate;
- room-project return and recommendation engagement;
- conversion/qualified-contact lift versus curated holdout.

Guardrails:

- latency/cache leakage;
- no-result/empty-module rate;
- out-of-stock/contact-price surprise;
- diversity and overexposure;
- opt-out/reset/complaint rate;
- incorrect/surprising explanation reports.

Do not declare improvement from tiny samples. Report confidence/sample size and combine quantitative results with merchandiser/customer-service review.

## Implementation phases

### Phase 0 — experience and policy contract

- inventory curated default modules and establish baseline metrics;
- freeze preference taxonomy, explanation copy keys, placements, and context precedence;
- approve consent/retention and customer controls.

### Phase 1 — session utility

- implement recent entities, continue-shopping module, bounded server resolver, private caching, and reset;
- no CRM/behavioral affinity needed.

### Phase 2 — explicit preferences

- preference center/onboarding prompts;
- homepage/catalog/PDP strategy selection through Plan 05;
- transparent reason labels and deterministic fallback.

### Phase 3 — customer memory and room projects

- consume frozen Plan 03/06 ports only;
- add connected-history transparency and room-project controls;
- internal/customer opt-in canary.

### Phase 4 — derived affinity

- compute support/decay features from consented Plan 01 events;
- shadow results and compare with explicit/default baseline;
- enable only stable feature types with minimum support.

### Phase 5 — experiments

- add deterministic assignment/holdout and approved module strategies only when traffic permits;
- no learning system until stable attribution and review thresholds exist.

## File ownership

This worktree owns new personalization context/preference/affinity/decision namespaces, migrations/tests, preference/recent UX, and placement strategy selection.

It consumes Plan 03 and Plan 05 public ports and Plan 06 owner-scoped room references. It does not edit their internals, Plan 01 identity/events, chatbot orchestration, commerce state, shared ProductCard, global providers/translations/env/schedules, generated types, or lockfile. Shared requests go to Plan 08.

## Test matrix

- default, anonymous session, explicit, authenticated memory, room, hybrid, withdrawn, stale, and outage contexts;
- preference create/edit/delete/exclusion/conflict/expiry;
- explicit precedence over affinity and staff-approved memory;
- event burst caps, support thresholds, decay, deterministic rebuild, and withdrawn-data exclusion;
- guest login merge, shared-device decline, logout, account switch, AMIS unlink;
- RLS for user A/B, anonymous, staff, worker;
- public/private cache isolation and no customer-specific CDN HTML;
- canonical price/stock/visibility at render;
- curated fallback for each dependency failure;
- explanation-key truthfulness;
- responsive/accessibility and preference controls;
- experiment assignment/holdout only when Phase 5 is enabled.

## Feature flags and rollback

- `PERSONALIZATION_ENABLED`;
- placement-specific flags;
- `RECENTLY_VIEWED_ENABLED`;
- `EXPLICIT_PREFERENCES_ENABLED`;
- `CUSTOMER_MEMORY_PERSONALIZATION_ENABLED`;
- `ROOM_PROJECT_PERSONALIZATION_ENABLED`;
- `BEHAVIOR_AFFINITY_ENABLED`;
- strategy/context version selectors.

Rollback selects curated defaults independently per placement. It does not delete explicit preferences; withdrawal/deletion uses the dedicated policy workflow.

## Definition of done

- the curated website remains complete with personalization off;
- initial value comes from recent utility and explicit preferences, not speculative ML;
- AMIS history enters only through verified, minimal `CustomerMemory`;
- every personalized product still passes Plan 05/canonical eligibility;
- customers can understand, edit, reset, disconnect, and delete the relevant context;
- private context cannot leak through API, cache, logs, events, or another account;
- each module records a truthful strategy/version/fallback without raw personal context.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase Queues](https://supabase.com/docs/guides/queues)
