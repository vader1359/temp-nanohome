# Worktree 01 — Customer Data, Identity, Consent, and Capability Foundation

Branch: `codex/customer-data-foundation-v2`

Base: exact `<PROGRAM_BASE_SHA>` produced by Plan 00

Status: planning only; this worktree must merge before feature worktrees 02-06 are created

## Outcome

Create the shared privacy, identity, event, and remote-access foundation without building commerce, AI, recommendations, vision, or personalization themselves.

At completion:

- an anonymous visitor and session can be recognized without exposing identifiers to browser JavaScript;
- an authenticated account can be linked to prior first-party activity through an explicit, auditable merge;
- consent is versioned by purpose and enforced before collection, external scripts, AI processing, or room-photo handling;
- all accepted customer events use one allowlisted, versioned envelope;
- feature worktrees can use an exact-method/exact-path remote capability factory without weakening the existing AMIS read-only guard;
- retention, deletion, RLS, rate limiting, and audit behavior are testable before personal data is collected.

## Scope

### In scope

- first-party visitor and session identity;
- guest-to-account identity merge;
- consent ledger and current consent projection;
- server event-ingestion contract and event allowlist;
- existing Meta Pixel, Clarity, Zalo, and future analytics consent gating;
- deletion/retention primitives and anonymization policy;
- aggregate tables needed by later recommendation and personalization lanes;
- exact remote capability factory for AMIS and other approved server integrations;
- shared fixtures for `ServerCustomerContext` and `ClientCustomerContext`.

### Out of scope

- copying AMIS customers or notes;
- recommendation scoring;
- chatbot conversations;
- room-photo upload;
- cart/order/payment behavior;
- cross-device fingerprinting, probabilistic identity matching, a CDP, or advertising audience construction.

## Identity model

### Anonymous visitor

On the first server response, issue:

- an opaque random `visitor_id` in an HttpOnly, Secure, SameSite=Lax cookie;
- a rotating `session_id` in a separate HttpOnly cookie;
- no phone, email, user-agent fingerprint, or catalog behavior inside either token.

The browser receives only a capability/consent projection. It must not receive the raw visitor or session identifier merely to send analytics.

### Authenticated customer

After verified Supabase authentication:

1. resolve the current visitor and user server-side;
2. create an append-only identity-link event;
3. move or associate only records covered by the current purpose consent;
4. keep the original anonymous identifiers for audit rather than rewriting historical rows;
5. make the merge idempotent;
6. reject linking where the visitor token is expired, malformed, already owned by another user, or produced outside the accepted session window.

Do not use email/phone/name similarity to connect a website account to an AMIS customer. That separate controlled link belongs to Plan 03.

## Consent model

Track purposes independently:

| Purpose | Default | Enables |
| --- | --- | --- |
| `essential` | on | session, cart, security, order status |
| `analytics` | off until choice where required | first-party analytics and approved measurement scripts |
| `personalization` | off | behavioral affinity, personalized placements, decision logging |
| `ai_processing` | off before customer uses AI | sending typed question/context to approved AI providers |
| `ai_conversation_storage` | off | retaining conversation content beyond the live request |
| `room_image_processing` | off before upload | temporary processing by the selected vision provider |
| `room_image_storage` | off | retaining normalized images beyond immediate analysis |
| `marketing` | off | Meta or other marketing tags where applicable |

Every consent change records policy version, locale, purposes, source UI, timestamp, actor context, and withdrawal reason if supplied. A current-consent projection is derived from the ledger; it is not the sole audit record.

Withdrawal behavior must be defined before launch:

- stop new purpose-specific collection immediately;
- disable corresponding third-party scripts and clear their non-essential cookies where technically supported;
- stop using old events for new personalization decisions;
- enqueue deletion/anonymization according to the approved retention policy;
- do not delete legally required order/payment audit records—restrict and minimize them instead;
- delete room images and derived customer-specific room records under Plan 06.

## Proposed data model

Use the reserved foundation migration lane from Plan 00.

### `customer_visitors`

- opaque visitor ID and hashed token verifier;
- creation, last-seen, expiry, revocation, and deletion timestamps;
- no behavioral JSON blob.

### `customer_sessions`

- session ID, visitor ID, optional verified user ID;
- start, last activity, expiry, locale, coarse acquisition source;
- server-derived security fields only when needed and with bounded retention.

### `customer_identity_links`

- visitor ID, user ID, link method, actor, evidence category, state;
- linked/revoked timestamps;
- unique active ownership constraints;
- append-only history for merges and revocations.

### `customer_consent_events`

- subject scope, purpose map, policy version, locale, source, timestamp;
- immutable append-only rows;
- current projection maintained transactionally or through a deterministic query.

### `customer_events`

- event ID, schema version, allowlisted name, occurred/received timestamps;
- visitor/session/user references resolved server-side;
- page/placement/entity identifiers;
- bounded typed properties;
- consent purpose and collection basis;
- idempotency key and safe request metadata.

Do not store arbitrary client JSON, raw URLs with query parameters, free-form notes, chat text, room scene payloads, addresses, phone numbers, emails, or payment values in this table.

### Aggregate projections

Create only aggregates with a named consumer:

- recent product/category/brand views;
- recommendation impression/click/add-to-cart/order attribution;
- placement-level session counts;
- consented pair signals for later recommendation work.

Raw events and aggregates have separate retention and deletion jobs.

## Event contract

Initial allowlist:

| Event | Required properties | Purpose |
| --- | --- | --- |
| `page_viewed` | route key, locale | analytics |
| `product_viewed` | canonical product/variant ID, placement | analytics or personalization |
| `search_submitted` | normalized filter keys, result-count bucket | analytics; never raw sensitive query by default |
| `recommendation_impression` | request ID, algorithm version, placement, item IDs | personalization measurement |
| `recommendation_clicked` | request ID, item ID, rank | personalization measurement |
| `cart_item_added` | canonical variant ID, source placement/request ID | essential commerce; optional attribution |
| `checkout_started` | order/cart ID, item count bucket | essential commerce |
| `preference_updated` | allowlisted preference keys | personalization |
| `room_analysis_confirmed` | analysis ID, correction flags only | AI/personalization; no image or full scene |

Envelope rules:

- server supplies identity and receive time;
- client-supplied user ID, price, stock, role, algorithm version, or consent is ignored;
- schema rejects unknown event names and unknown properties;
- strings, arrays, and batches have strict length limits;
- idempotency prevents duplicate retries;
- authorization and entity visibility are checked before persistence;
- rate limits apply by session, user, IP bucket, and event class;
- event ingestion never grants feature access.

## Exact remote capability factory

The current `src/lib/remote-read-only.ts` guard must not become a generic escape hatch. Replace or wrap it with capabilities constructed from an explicit declaration:

```ts
type RemoteCapability = {
  origin: string;
  methods: readonly ("GET" | "POST")[];
  pathPatterns: readonly RegExp[];
  purpose: string;
};
```

Required policy:

- deny by default;
- match normalized origin, exact HTTP method, and anchored path;
- reject redirects to another origin;
- prevent caller-supplied authorization headers;
- apply timeout, response-size, content-type, and redacted logging controls;
- do not accept wildcard AMIS paths;
- foundation provides mechanism and tests only;
- Plan 02 requests `POST /api/v2/SaleOrders` plus exact reconciliation GETs;
- Plan 03 requests only Customers, Contacts, and SaleOrders GET paths;
- every capability has a feature flag and owner.

The factory must prove that enabling one AMIS Sale Order mutation cannot enable Customers/Contacts mutation, PUT, PATCH, DELETE, or arbitrary POST.

## Existing tracking migration

Inventory every network request made by:

- `src/components/analytics/meta-pixel.tsx`;
- `src/components/analytics/meta-pageview-tracker.tsx`;
- `src/components/analytics/tracking-provider.tsx`;
- any Clarity, Zalo, tag-manager, or embedded widget integration found at implementation time.

For each integration, record owner, cookie/storage behavior, purpose, load condition, withdrawal behavior, and CSP domains. Scripts must not load before their approved consent condition. Essential application behavior cannot depend on marketing consent.

## RLS and privileged paths

- browser roles cannot insert arbitrary customer events directly;
- a narrow server route validates and writes through one controlled function;
- users may read only their current consent, explicit preferences, and customer-facing history where a product requirement exists;
- users cannot enumerate anonymous visitor/session rows;
- service-role operations are restricted to server/worker modules and are never imported by client bundles;
- staff access is a separate role and audited;
- retention/deletion workers use bounded functions rather than table-wide generic mutation endpoints.

## Implementation sequence

### Phase 0 — policy and inventory

- approve consent purposes, retention windows, and legal/audit exceptions;
- inventory current cookies, local storage, scripts, and event producers;
- freeze event names and payload budgets;
- verify the relevant Next.js 16.2.7 route/cookie guidance in installed docs.

### Phase 1 — identity and consent

- add migrations, RLS, server resolvers, token rotation, and consent ledger;
- add fixtures for anonymous, authenticated, withdrawn, and expired contexts;
- expose a client-safe consent/capability projection;
- keep all non-essential third-party scripts disabled initially.

### Phase 2 — event ingestion

- add schema registry, narrow ingestion route, idempotency, rate limits, and redaction;
- instrument only the minimum event producers needed by Plans 05 and 07;
- add aggregate jobs after raw-event correctness is proven.

### Phase 3 — capability factory

- implement exact route/method enforcement and redirect tests;
- migrate existing AMIS reads without changing behavior;
- publish fixtures for the feature worktrees;
- do not add commerce or customer-memory routes in this lane.

### Phase 4 — tracking cutover

- gate each current integration;
- verify network silence before consent and after withdrawal;
- enable first-party measurement in a small internal rollout.

## File ownership

This worktree owns:

- new `src/lib/customer-context/**`, `src/lib/consent/**`, `src/lib/events/**` namespaces;
- narrow identity/consent/event routes;
- foundation migrations and RLS tests;
- the exact remote capability factory and its tests;
- initial provider wiring in `src/app/providers.tsx`.

It must not own:

- commerce, AMIS CRM projection, chatbot, recommender, vision, or personalized placements;
- shared translations, generated DB types, environment schema, schedules, or lockfile—request these in the handoff for Plan 08.

## Test plan

### Identity and consent

- first visit, token rotation, expiry, revocation, tampering, and fixation;
- concurrent session creation and idempotent guest-to-user merge;
- cross-user merge rejection;
- independent purpose grant/withdrawal and policy-version upgrade;
- client context never exposes visitor/session tokens.

### Events

- every allowlisted schema and every rejected unknown/oversized field;
- server identity overriding forged client values;
- batch and retry deduplication;
- rate-limit boundaries;
- no raw search text, PII, free-form notes, signed URLs, prices, or stock snapshots in general events.

### RLS and security

- anonymous, authenticated A/B, staff, worker, and service-role matrices;
- browser cannot enumerate or directly insert;
- deletion worker is tenant/subject scoped;
- secrets never enter client bundles or logs.

### Capability factory

- each exact allowed method/path succeeds in a mock;
- near-match, query/path traversal, redirect, alternate origin, PUT/PATCH/DELETE, and wildcard attempts fail;
- one enabled capability cannot borrow another feature's routes.

### Tracking

- automated browser network assertions before consent, after grant, and after withdrawal;
- essential cart/auth behavior works with every optional purpose disabled.

## Handoff to parallel worktrees

Publish:

- `<FOUNDATION_SHA>`;
- schema and fixtures for customer context, consent, and events;
- exact capability construction API and mock server;
- reserved migration-lane confirmation;
- shared-file change requests for integration;
- known policy decisions still marked unresolved.

All Worktrees 02-06 must branch from exactly `<FOUNDATION_SHA>`, not from moving `main`.

## Definition of done

- the identity/consent/event contracts are versioned and covered by RLS/contract tests;
- no optional third-party request occurs without its purpose consent;
- withdrawal stops new collection and creates the correct deletion/restriction work;
- exact capabilities preserve the global deny-by-default remote policy;
- fixture consumers compile without importing feature internals;
- foundation migrations apply on both Plan 00 database paths;
- the branch is merged and one `<FOUNDATION_SHA>` is recorded for all parallel worktrees.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase Queues](https://supabase.com/docs/guides/queues)
