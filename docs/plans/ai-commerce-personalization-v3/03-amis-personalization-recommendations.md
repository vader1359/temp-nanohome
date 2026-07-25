# Plan 03 — AMIS Personalization and Recommendations

Status: implementation-ready after AMIS tenant contract proof
Baseline: `origin/codex/ai-commerce-staging@b4d28a3`

## 1. Outcome

Use verified AMIS Customers, Contacts, and SaleOrders to improve:

- homepage product modules;
- PDP related/complementary products;
- cart recommendations;
- chat recommendations;
- Customer Advisor context.

The system must distinguish:

- purchased: approved, active SaleOrder;
- quoted or interested: active SaleOrder not approved.

It must never expose raw CRM data or confuse a quote with a purchase.

## 2. Current gaps

- AMIS Customers is currently blocked by the runtime read allowlist.
- Contacts is not wired.
- SaleOrder reader lacks a stable customer/contact relation.
- SaleOrder pagination starts at page `1`; MISA v2 lists start at page `0`.
- Current memory mapper treats every supplied order as purchased.
- No live Customer/Contact sync worker builds customer memory.
- `CustomerMemoryPort` is fixture/disabled or reads a prebuilt projection.
- Personalization is gated by consent across UI, API, resolver, event service, and SQL views.
- Homepage selection remains curated.
- Recommendations support PDP only and rank by same price band.
- Affinity tables exist, but there is no production signal builder.

Removing only the consent banner would not activate personalization. Every dependent gate must be migrated.

## 3. Tenant contract spike

Before backfill, collect redacted responses from the actual AMIS tenant:

- `GET /api/v2/Customers`;
- `GET /api/v2/Contacts` if available in the tenant;
- `GET /api/v2/SaleOrders`;
- Customer by exact ID/code;
- SaleOrder by exact ID/code.

Prove:

- page starts at `0` and maximum page size;
- stable customer ID/code;
- stable Contact-to-Customer relation;
- stable SaleOrder-to-Customer relation;
- exact approved field/value;
- deleted/cancelled/merged semantics;
- modified timestamp and ordering;
- order line SKU;
- rate limits;
- custom fields used for room, brand, project stage, or advisor brief.

Do not join on display name. If the tenant does not return a stable customer key in SaleOrders, stop and request a supported mapping/export from MISA.

## 4. AMIS read-only sync

### 4.1 Allowlist

Add exact read capabilities:

- `GET /api/v2/Customers`;
- `GET /api/v2/Contacts`;
- `GET /api/v2/SaleOrders`.

Keep generic path construction, mutation, and unrelated entities denied.

AMIS write capabilities remain separate:

- checkout SaleOrder draft/create/promote uses a dedicated narrow port;
- personalization sync never writes Customers, Contacts, notes, tasks, or custom fields.

### 4.2 Clients

Add:

- `src/lib/amis/customer-client.ts`
- `src/lib/amis/contact-client.ts`
- extend `src/lib/amis/sale-order-client.ts`

Client rules:

- start at `page=0`;
- page size `100` when accepted by tenant;
- sort by modified time descending;
- refresh expired token at most once;
- strict Zod allowlist of consumed fields;
- response-level and row-level success validation;
- bounded pages/records/time;
- payload digest and safe diagnostics;
- never log token, phone, email, address, notes, raw payload, debt, or price/margin details.

### 4.3 Sync schedule

Delta sync every 15–30 minutes:

1. Acquire database advisory lock.
2. Load last committed watermark.
3. Read with an overlap window.
4. Normalize and validate.
5. Quarantine malformed/ambiguous rows.
6. Upsert snapshots by AMIS ID plus source timestamp/digest.
7. Rebuild affected projections.
8. Commit snapshots, projections, and next watermark atomically.
9. Release lock.

Nightly reconciliation:

- full active ID inventory;
- detect deletes/merges;
- rebuild signals for affected links;
- report missing pages, duplicate IDs, ambiguous SKUs, stale links.

Cursor never advances before successful commit.

## 5. Identity and account linking

CRM personalization is authenticated only:

```text
Firebase-authenticated domain account (`customer_accounts.id`)
  -> active verified customer_amis_link
  -> exact AMIS Customer
  -> safe customer projection
```

All account ownership in this workstream uses the Plan 04 internal UUID. Legacy `auth.users` foreign keys, `user_id` columns, and Supabase access-token assumptions are migration inputs, not the target contract.

Allowed link methods:

- staff selects exact AMIS Customer ID/code;
- trusted migration with documented evidence;
- OTP to an independently verified channel if implemented.

Disallowed:

- fuzzy name match;
- browser-supplied AMIS ID;
- unauthenticated phone/email lookup;
- exposing whether another person has an AMIS record.

Guest behavior:

- current-session recently viewed/search/cart may shape the session;
- no AMIS memory;
- no guest-to-AMIS merge until login/link verification;
- logout/account switch clears private cached context.

## 6. Engagement classification

### 6.1 Canonical rule

```text
purchased =
  not deleted
  AND not cancelled
  AND approved_status == tenant-confirmed approved value

quoted_or_interested =
  not deleted
  AND not cancelled
  AND not purchased
```

The current observed code uses `Đã duyệt`; freeze this only after tenant proof.

### 6.2 Mapping

- `purchased` lines → `purchasedVariantIds`.
- `quoted_or_interested` lines → `discussedVariantIds`.
- status transition to purchased removes the discussed signal and adds purchase exactly once.
- deletion/cancellation removes active influence on the next projection rebuild.
- SKU must map to exactly one canonical variant.
- ambiguous/missing SKU contributes nothing and enters a review queue.

Do not split “quote” and “interest” unless AMIS exposes a reliable field/custom field. The initial truthful bucket is `quoted_or_interested`.

### 6.3 Additional first-party signals

Server-validated signals may include:

- explicit preferred brand/room/material;
- product viewed in current session;
- product clicked from recommendation;
- cart addition;
- chat product shown/clicked;
- submitted quote request;
- customer-excluded item.

Marketing pixels are not the source of truth for personalization.

## 7. Data model

Use a new additive migration.

### 7.1 Restricted snapshots

`amis_customer_snapshots`

- stable AMIS customer ID/code;
- customer type;
- created/modified timestamps;
- safe structured custom fields only;
- source state/digest/version.

`amis_contact_snapshots`

- stable Contact ID/code;
- owning Customer ID/code;
- source state/timestamps;
- no email/phone unless an approved verification workflow requires encrypted/restricted access.

`amis_sale_order_summaries`

- stable order ID/code;
- stable Customer relation;
- order lifecycle status;
- `engagement_kind`;
- occurred/approved/source-updated timestamps;
- exact SKUs and canonical variant IDs;
- digest and mapper version;
- no raw note, debt, address, margin, or internal comment.

Browser roles have no direct access to these tables.

### 7.2 Staff-approved memory

`customer_memory_briefs`

- AMIS link ID;
- preferred rooms/brands;
- project stage;
- customer-visible summary;
- structured discussed products;
- source `amis_custom_field | staff_brief | approved_import`;
- approver, reviewed/expiry timestamps, version.

This table is used only when AMIS custom fields cannot provide a reliable structured brief. It is not presented as an AMIS note mirror.

### 7.3 Recommendation signals

`customer_recommendation_signals`

- owner user/link ID;
- canonical variant;
- kind:
  - `purchased`;
  - `quoted_or_interested`;
  - `explicit_preference`;
  - `session_interest`;
  - `excluded`;
- count;
- first/last timestamp;
- expiry;
- projection version.

`customer_memory_projections`

- purchased variant IDs;
- discussed variant IDs;
- preferred room/brand IDs;
- project stage;
- safe customer-visible summary;
- source watermark;
- generated/expiry timestamps.

Only a server-resolved owner can read its safe projection.

### 7.4 Product features

Create `variant_recommendation_features`:

- canonical variant/product IDs;
- category/subcategory;
- room;
- brand;
- designer;
- collection;
- style;
- material;
- palette;
- price band;
- complementary group;
- repeatable/durable flag;
- eligibility, image, stock, and freshness.

This projection is required because current catalog eligibility alone cannot provide meaningful customer-aware ranking.

## 8. Remove consent from product runtime

### 8.1 Replacement setting

Create `customer_personalization_settings`:

- user ID;
- `enabled`;
- `use_amis_history`;
- `use_behavior_history`;
- `policy_version`;
- updated timestamp and actor.

Default proposal:

- account personalization: enabled after account/AMIS link with visible settings;
- AMIS history: enabled only for verified linked customer according to approved business policy;
- behavioral history: off by default;
- current-session utility: available without cross-session tracking;
- marketing/analytics: outside this plan and never auto-enabled.

### 8.2 Migration sequence

1. Add settings and policy service.
2. Make resolver support both old consent and new settings in shadow.
3. Migrate API DTOs away from `consent`.
4. Migrate SQL active views.
5. Migrate events and customer runtime.
6. Migrate components and copy.
7. Add account settings actions: disable, reset, disconnect AMIS.
8. Remove `ConsentCenter` from layout.
9. Deprecate consent endpoint/table consumers.
10. Retain historical ledger until retention/data governance permits cleanup.

Files requiring attention:

- `src/components/privacy/consent-center.tsx`
- `src/app/[locale]/layout.tsx`
- `src/app/api/customer/consent/route.ts`
- `src/app/api/customer/context/route.ts`
- `src/app/api/customer/personalization/route.ts`
- `src/lib/personalization/index.ts`
- `src/lib/personalization/customer-runtime.ts`
- `src/lib/events/service.ts`
- personalization/event SQL views and functions
- personalization UI components and translations.

### 8.3 Controls that remain

- purpose and source logging;
- customer-visible explanation;
- disable/reset/disconnect;
- retention and deletion/correction;
- owner isolation;
- no-store private responses;
- staff-only raw snapshot access;
- model prompt minimization.

Removing the banner is a UX change, not permission to expose CRM data.

## 9. Personalization resolver

New input:

```ts
type PersonalizationInput = {
  userId: string | null;
  locale: string;
  settings: CustomerPersonalizationSettings;
  currentIntent: CurrentIntent | null;
  recentSession: RecentEntity[];
  explicit: PreferenceFeature[];
  now: string;
};
```

Precedence:

1. current page/chat/cart intent;
2. explicit preferences and exclusions;
3. AMIS quote/interest;
4. AMIS purchases;
5. current-session recent utility;
6. curated default.

Explicit user choice always overrides inferred/CRM signals.

Failure behavior:

- missing link → no CRM memory;
- stale projection → curated/session fallback;
- AMIS outage → last fresh projection within configured age, otherwise fallback;
- malformed signals → exclude them;
- disabled setting → immediate curated fallback.

## 10. Recommendation algorithm

### 10.1 Phase 1 deterministic scoring

Hard filters first:

- public/current/canonical;
- valid image;
- eligible for placement;
- current commercial facts;
- stock policy;
- customer exclusion;
- current cart duplication;
- exact same product/variant constraints.

Then score:

```text
score =
  current_intent_match
  + explicit_preference_match
  + previous_interest_match
  + purchase_complement_match
  + session_recency_match
  + merchandising_priority
  - already_owned_penalty
  - repeated_family_penalty
  - stale_signal_penalty
```

Suggested starting weights:

| Signal | Weight |
| --- | ---: |
| Current intent match | +50 |
| Explicit preference | +40 |
| Previous quote/interest match | +25 |
| Complement to purchase | +20 |
| Session recent match | +10 |
| Curated priority | +5 |
| Exact durable product already purchased | -100 |
| Explicit exclusion | hard exclude |

Weights are versioned and reviewed with merchandising; they are not client-controlled.

### 10.2 Time behavior

Proposed horizons:

- quote/interest: 180 days;
- purchase complement: 24–36 months;
- session interest: session or max 14 days if account setting allows;
- explicit preference: until changed;
- exclusion: until reset.

Use configurable decay rather than deleting legally required AMIS order evidence.

### 10.3 Placement behavior

Homepage:

- blend explicit preference, previous interest, and complements;
- four to eight products;
- curated fallback always available.

PDP:

- current product remains strongest context;
- CRM signals break ties and choose alternative/complement strategy.

Cart:

- complementary only;
- no duplicate product/family;
- no contact-price surprise without clear labeling.

Chat:

- current question dominates;
- AMIS memory may personalize only for authenticated linked user;
- do not reveal private history in the response;
- safe explanation: `Phù hợp với những sản phẩm bạn đã quan tâm`.

### 10.4 Reason codes

Allowlisted localized codes:

- `matches_current_request`;
- `matches_explicit_preference`;
- `matches_previous_interest`;
- `complements_previous_purchase`;
- `similar_material_or_style`;
- `curated_default`.

Do not show:

- raw order number;
- purchase amount;
- internal AMIS status;
- advisor notes;
- exact private history unless the customer opens account order history.

## 11. Customer Advisor and chat use

`CustomerMemoryPort` supports two authenticated purposes:

- `personalization`;
- `concierge`.

Concierge receives only:

- purchased/discussed canonical variant IDs;
- preferred rooms/brands;
- project stage;
- customer-visible summary;
- freshness/version.

The assistant does not get customer phone/email, raw AMIS IDs, order amounts, notes, debt, or address. A handoff can attach the verified AMIS link for staff use inside the Advisor Inbox.

## 12. Caching

- private response: `Cache-Control: private, no-store`;
- server cache key includes user ID, link/projection version, settings version, locale, placement, and current intent;
- never CDN-cache personalized payload;
- account switch/logout invalidates browser state;
- AMIS projection update changes version and invalidates server result;
- canonical product rehydration happens at render/request time.

## 13. Implementation slices

### Slice A — AMIS contract and clients

- tenant samples;
- page-0 fix;
- Customer/Contact allowlist;
- exact relation fields;
- client tests.

### Slice B — snapshots and projection

- additive migration;
- service-role RPC;
- delta/full sync;
- dead-letter/reconciliation;
- generated types.

### Slice C — settings without banner

- settings schema/service/page;
- dual-run old/new gate;
- API/resolver/SQL migration;
- remove ConsentCenter after final consumer.

### Slice D — recommender

- feature projection;
- signals;
- deterministic scoring;
- home/PDP/cart/chat adapters;
- reason codes and product carousels.

### Slice E — Advisor context

- concierge projection;
- Advisor Inbox AMIS link;
- safe handoff summary.

## 14. Acceptance tests

Sync:

- page 0 is always read;
- pagination change/missing page fails the run;
- duplicate/out-of-order records are idempotent;
- malformed row enters quarantine;
- cursor advances only after commit;
- deleted/merged customer/order is reconciled.

Classification:

- unapproved never enters purchased;
- approved transition occurs once;
- deleted/cancelled order contributes no signal;
- ambiguous SKU contributes no signal;
- exact customer link is required.

Security:

- customer A cannot read B;
- guest cannot query CRM memory;
- arbitrary phone/email/AMIS ID lookup is impossible;
- raw AMIS payload/PII never reaches browser, DeepSeek, logs, or analytics;
- private cache cannot leak after logout/account switch.

Recommendations:

- every item passes canonical eligibility;
- purchased durable item is suppressed;
- complementary item can rank;
- previous interest boosts alternatives;
- explicit preference wins;
- AMIS outage returns curated fallback;
- explanation uses only allowlisted reason code;
- disable/reset/disconnect applies immediately.

## 15. Official references

- [MISA CRM Connect v2 API](https://crmconnect.misa.vn/docs-v2/index.html)
- [AMIS CRM API setup notes](https://helpcrm.misa.vn/kb/api/)
