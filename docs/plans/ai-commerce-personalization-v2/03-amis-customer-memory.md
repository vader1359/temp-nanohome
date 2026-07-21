# Worktree 03 — AMIS Customer Memory and Safe Concierge Context

Branch: `codex/amis-customer-memory`

Base: exact `<FOUNDATION_SHA>` from Plan 01

Status: planning only

## Outcome

Make approved AMIS customer history useful to the website without turning the public chatbot into an internal CRM search engine.

The deliverable is a bounded `CustomerMemoryPort` that can answer: “What safe, verified context may this experience use for this exact customer?” It is not a raw AMIS mirror and not a general notes RAG system.

## Confirmed AMIS boundary

The public CRM Connect v2/OpenAPI currently documents read paths for:

- Customers by page, ID, and code;
- Contacts by page, ID, and code;
- Products and Stocks;
- SaleOrders;
- account/token operations.

AMIS UI documentation shows richer customer activity such as calls, meetings, tasks, notes, campaigns, and consultation cards (`Thẻ tư vấn`). Those activity objects are not exposed in the public Swagger paths reviewed for this plan.

Therefore the plan must not invent an API for notes or consultation cards. Access them through one of these separately approved options:

1. ask MISA to enable/provide a documented tenant-specific API or webhook;
2. maintain staff-approved, AI-safe summary/custom fields on Customer or Contact if the actual tenant API returns configured custom fields reliably;
3. use a periodic staff export into a controlled import queue as a temporary fallback;
4. keep the information inside AMIS and require staff handoff when none of the above is supportable.

Browser automation/scraping of the AMIS UI is not a production integration.

## Three access scopes

### Public assistant

- no AMIS customer lookup;
- no phone/email collection for silent matching;
- only public catalog, brand, designer, policy, and editorial facts.

### Authenticated customer concierge

- requires a verified Supabase-user-to-AMIS link;
- returns only the `CustomerMemory` customer-safe projection;
- may use prior purchased/discussed product IDs, approved preferences, project stage, and customer-visible summary;
- never exposes internal notes, staff names/comments, debt, bank, identity-document, private address, or another contact's data.

### Future staff assistant

- separate internal route, UI, RBAC, audit policy, prompt, and provider/data-processing approval;
- not enabled by adding a `staff=true` argument to the public assistant;
- raw activity still requires purpose and field-level authorization.

## Source-of-truth and direction

AMIS remains authoritative for Customer, Contact, offline Sale Order, and operational activity. Supabase stores a minimal read-only projection for low-latency authorization and customer-facing use.

Initial synchronization is one-way AMIS → Supabase. This worktree does not update AMIS Customers, Contacts, notes, tags, tasks, or consultation cards.

The only planned AMIS write in the overall program belongs to Plan 02's isolated Sale Order capability.

## Required tenant contract spike

Before schema implementation, capture real redacted responses from a test tenant and prove:

- pagination, maximum page size, ordering, and update filters;
- stable Customer/Contact/SaleOrder IDs and codes;
- timestamp format and update semantics;
- custom-field names, types, null behavior, and whether all configured fields are returned;
- deletion/merge/archive behavior;
- contact-to-customer relation cardinality;
- customer-to-SaleOrder relation and line-level SKU availability;
- rate limits, token expiry, retry guidance, and partial/record-level failures;
- whether a documented webhook or incremental cursor exists for this tenant.

Build fixtures from redacted payloads. Unknown fields remain ignored until intentionally mapped; they must not flow into a generic JSON projection.

## Identity linking

### Required rule

A Supabase user may access AMIS-derived memory only through an active, verified link row created by an approved method:

- exact AMIS customer/contact code entered and verified by staff;
- explicit staff selection in a restricted linking UI;
- migration from an already trusted mapping with evidence;
- a future customer verification flow using a one-time code sent to a contact channel that is independently verified.

Never auto-link by fuzzy name, email, phone, company, address, or similarity score. Exact email/phone alone can still be shared/recycled and should create a review candidate, not an active link.

### Link lifecycle

States:

```text
proposed -> verified -> active
proposed -> rejected
active -> suspended | revoked
suspended -> active | revoked
```

Record link method, actor, evidence category, AMIS customer/contact IDs, timestamps, and reason. Do not store the evidence secret itself. Account merge, email/phone change, AMIS customer merge, and deletion each trigger review or deterministic relinking rules.

## Safe customer-memory contract

The frozen DTO from Plan 00 is the maximum general customer-facing contract:

```ts
type CustomerMemory = {
  linkId: string;
  customerType?: string;
  customerSinceBucket?: string;
  preferredRoomIds: string[];
  preferredBrandIds: string[];
  discussedVariantIds: string[];
  purchasedVariantIds: string[];
  projectStage?: string;
  customerVisibleSummary?: string;
  lastInteractionAt?: string;
  sourceUpdatedAt: string;
};
```

### Safe candidates after approval

- stable AMIS customer/contact IDs and codes in restricted link tables;
- coarse customer type and tenure bucket;
- purchased exact SKUs mapped to canonical variant IDs;
- explicitly curated brand/room/project preferences;
- discussed products only when the source is a staff-approved structured field/export;
- project stage from an allowlist;
- a customer-visible summary deliberately written for sharing with the customer;
- coarse last-interaction timestamp.

### Excluded from the general projection

- raw call, email, meeting, chat, task, note, or consultation-card content;
- attachments and image/document URLs;
- phone, email, private address, ID number, bank, debt, credit, revenue, margin, or internal score;
- staff-only sentiment, negotiation position, complaint analysis, or personal observations;
- arbitrary AMIS custom fields;
- another contact's or household member's data;
- free text generated automatically from raw notes without staff review.

DeepSeek must never receive a full Customer/Contact/SaleOrder object.

## Handling previous conversations and consultation cards

The preferred pattern is not to copy all notes. Create a structured, staff-reviewed “AI-safe customer brief” with fields such as:

- approved room/project IDs;
- preferred brands/designers;
- discussed canonical product/SKU IDs;
- budget band only if the customer provided it for this shopping purpose;
- service/contact preference;
- project stage;
- short customer-visible summary;
- expiry/review date and approving staff member.

If MISA exposes custom Customer/Contact fields in this tenant, store the structured brief there and read it through the documented endpoint. Otherwise create the brief in a restricted Supabase staff tool or controlled import. Label the Supabase-origin brief clearly; do not pretend it is an AMIS note mirror.

Raw activity remains visible to staff in AMIS. The website can offer a handoff: “Nhân viên tư vấn sẽ xem lại lịch sử trao đổi và liên hệ với bạn,” without exposing or summarizing inaccessible notes.

## Proposed data model

Use the reserved AMIS customer-memory migration lane.

### `amis_customer_snapshots`

- AMIS customer ID/code;
- allowlisted structured fields only;
- source update timestamp, fetch timestamp, schema/mapper version;
- active/deleted/merged state;
- payload digest, not raw payload.

### `amis_contact_snapshots`

- AMIS contact ID/code and owning customer ID;
- only fields required for relationship verification and approved service behavior;
- update/fetch timestamps and state;
- contact channels encrypted/restricted if they are required for a verification workflow, otherwise omit them.

### `amis_sale_order_summaries`

- AMIS Sale Order ID/code, linked customer ID, coarse status/date;
- line exact raw SKU, quantity, and mapped canonical variant ID;
- no internal price/margin/debt fields unless a separately approved customer order-history requirement needs a snapshot.

### `customer_amis_links`

- Supabase user ID, AMIS customer/contact IDs;
- link state/method, actor, evidence category, timestamps, review reason;
- unique active ownership and conflict constraints.

### `customer_memory_projections`

- link ID, versioned `CustomerMemory` JSON or typed columns;
- source watermark, projection version, approved/expiry timestamps;
- no raw source payload;
- deterministic rebuild capability.

### `customer_memory_briefs`

- structured allowlisted preferences and product IDs;
- short customer-visible summary;
- provenance (`amis_custom_field`, `staff_supabase`, `approved_export`);
- author/approver, review/expiry timestamps, supersession history.

### Synchronization/audit tables

- `amis_sync_cursors` per entity;
- `amis_sync_runs` with counts and safe errors;
- `amis_snapshot_changes` or digests for traceability;
- reconciliation queue for missing, merged, deleted, or conflicting identities.

## Synchronization design

1. acquire a per-entity advisory/job lock;
2. read from the last successful watermark with an overlap window;
3. paginate to completion;
4. validate each record with an allowlist mapper;
5. deduplicate by AMIS ID plus source update time/digest;
6. upsert snapshot state and rebuild affected projections transactionally;
7. advance the cursor only after the complete page/run commits;
8. periodically perform a slower full reconciliation to discover deletions/merges missed by incremental reads;
9. move repeated invalid records to an operator-visible dead-letter queue without stopping all good records.

If AMIS does not guarantee stable incremental ordering, use overlapping polling and idempotent digests. Never assume “last page read” means all earlier updates were captured.

## `CustomerMemoryPort`

```ts
interface CustomerMemoryPort {
  getForAuthenticatedCustomer(input: {
    userId: string;
    purpose: "concierge" | "personalization";
  }): Promise<CustomerMemory | null>;
}
```

The port:

- accepts server-resolved user ID only;
- checks authentication, active verified link, purpose consent, projection freshness, and field policy;
- returns `null` for unlinked, stale, suspended, deleted, or unauthorized states;
- never offers lookup by arbitrary AMIS ID, phone, email, or name;
- logs request ID, purpose, policy version, allowlisted fields returned, and outcome—not returned values;
- can be replaced by a no-op fixture so chatbot/personalization continue without AMIS.

## Customer experience

Authenticated users need a clear settings surface:

- whether prior shopping history is connected;
- high-level categories of memory used;
- edit/remove explicit preferences;
- disconnect AMIS history and stop new use;
- request correction or staff review;
- understand that internal staff records are not displayed by the chatbot.

Do not reveal that a hidden link exists before authentication. Do not tell a user whether a supplied phone/email belongs to an AMIS record.

## Security and privacy

- RLS permits each user to read only their own customer-facing projection, never raw snapshots or links for other users;
- browser roles cannot query AMIS snapshot tables directly;
- sync workers and staff linking operations use separate audited capabilities;
- AMIS access tokens stay server-side and are redacted;
- logs contain IDs/digests and safe result codes, not payloads;
- purpose withdrawal disables the port immediately and queues derived-memory deletion/restriction;
- retention for identity link, snapshots, briefs, and order evidence is separately approved;
- customer-facing AI does not see raw notes even if staff access exists elsewhere.

## Implementation phases

### Phase 0 — tenant/API proof and field classification

- execute the tenant contract spike;
- inventory desired Customer, Contact, SaleOrder, note, consultation-card, and custom-field information;
- label each requested field public/customer-safe/staff-only/prohibited;
- obtain the supported path for activity summaries or accept the handoff fallback.

### Phase 1 — read-only projection

- build exact GET capabilities and typed adapters;
- add snapshot/cursor/run tables, RLS, polling, overlap, reconciliation, and redaction;
- sync internally with no website consumer.

### Phase 2 — verified linking

- add staff-reviewed link workflow and conflict queue;
- add customer visibility/disconnect UX;
- prove cross-user isolation and lifecycle cases.

### Phase 3 — customer-memory projection

- implement deterministic projection and `CustomerMemoryPort`;
- add structured brief with provenance/review/expiry;
- enable only for internal test accounts.

### Phase 4 — limited consumers

- expose the port first to authenticated concierge behind a feature flag;
- later expose approved preference fields to Plan 07 personalization;
- measure null/stale/link-conflict rates and customer corrections.

## File ownership

This worktree owns new `src/lib/amis-customer-memory/**`, exact read adapters requested through the foundation factory, sync workers/routes, customer-memory migrations/tests, restricted link/brief operations, and the `CustomerMemoryPort` implementation.

It must not edit chatbot/recommendation/personalization internals, generic remote capability code, shared schedules, environment schema, translations, generated DB types, global providers, or lockfile. Record those needs in the Plan 08 handoff.

## Test matrix

- AMIS pagination, overlap, duplicate records, out-of-order updates, invalid fields, token refresh, timeout, and reconciliation;
- field mapper drops every unknown/unsafe field;
- customer/contact merge, deletion, archive, and missing relation;
- exact manual link, conflicting ownership, suspension, revocation, account merge, and unlink;
- anonymous and public assistant always receive no memory;
- authenticated user A cannot access user B or enumerate existence;
- stale/failed sync returns no memory or a bounded stale policy, never silent old data;
- raw notes/custom payloads/phone/email/address/attachments never appear in port output, general events, AI logs, or client bundles;
- consent withdrawal disables the port immediately;
- deterministic projection rebuild produces the same approved output;
- AMIS outage leaves public catalog/chat and non-CRM personalization functional.

## Definition of done

- current public AMIS API limitations and tenant evidence are documented;
- Customers/Contacts/SaleOrders sync one-way through exact GET capabilities;
- every active website-to-AMIS link is verified and auditable, with no fuzzy auto-link;
- `CustomerMemoryPort` returns only the frozen approved DTO;
- previous conversations/consultation cards use a documented API, staff-approved structured brief, or explicit handoff—not fabricated access;
- customer, staff, and sync scopes pass RLS and redaction tests;
- disabling the feature or AMIS outage safely returns `null` without breaking the website.

## Official references

- [AMIS CRM Connect v2](https://crmconnect.misa.vn/docs-v2/index.html)
- [AMIS OpenAPI JSON](https://crmconnect.misa.vn/swagger/v2/swagger.json)
- [AMIS API notes](https://helpcrm.misa.vn/kb/api/)
- [AMIS customer activity history](https://helpcrm.misa.vn/kb/quan-ly-chi-tiet-ban-ghi-khach-hang/)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
