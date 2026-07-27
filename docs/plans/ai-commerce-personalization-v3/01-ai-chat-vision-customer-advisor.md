# Plan 01 — AI Chat, Vision, and Customer Advisor

Status: implementation-ready after Phase 0 provider and operations decisions
Baseline: `origin/codex/ai-commerce-staging@b4d28a3`

## 1. Definition of done

The AI advisor must:

- answer product and nanoHome knowledge questions using approved sources;
- speak politely, concisely, warmly, and with restrained humor;
- render product/media results as horizontal carousels;
- accept customer images and return grounded room/image observations;
- remember the current conversation across reloads;
- create a real Customer Advisor handoff with customer-controlled contact details;
- give the advisor a secure transcript, summary, product context, and ownership workflow.

## 2. Current gaps to remove

| Area | Current implementation | Gap |
| --- | --- | --- |
| Knowledge | `ApprovedSourceStore` populated from localized site messages | Small, in-memory, no admin ingestion or persistent chunks |
| Catalog | `search_public_chat_catalog` plus canonical server cards | Good foundation; keep it |
| Tone | Safe factual system prompt | No explicit brand voice or humor policy |
| Cards | Private chat `ProductCard` | Duplicates product-card design and renders a two-column grid |
| Images | Server can render approved catalog images | Customer cannot attach an image |
| Vision | Contracts, lifecycle, synthetic provider | No endpoint, storage wiring, worker, or real provider |
| Persistence | `conversations`, `chat_messages`, evidence tables | Route and UI never write/read them |
| Handoff | Tool contract and static UI note | Live adapter throws; no queue, contact capture, or staff inbox |

## 3. Knowledge completion

### 3.1 Approved source inventory

Create a managed inventory with an owner and freshness rule for each source:

| Source | Data | Owner | Refresh |
| --- | --- | --- | --- |
| Product/variant catalog | title, brand, designer, collection, material, size, price mode, stock | Commerce | event/delta |
| Brands/designers/collections | approved public description and relationships | Merchandising | daily |
| Product care | material care, cleaning, installation limits | Customer Advisor | on approval |
| Delivery | areas, lead time language, installation and exceptions | Operations | on approval |
| Warranty/after-sales | public warranty and service steps | Customer Advisor | on approval |
| Payment/checkout | accepted method, quote flow, SePay instructions | Commerce | on release |
| Showrooms/contact | address, hours, phone, channel | Operations | daily |
| FAQ | curated customer questions and approved answers | Customer Advisor | weekly |
| Editorial/Notion | public buying guides and design stories | Content | event/daily |
| Internal advisor playbook | only explicitly approved customer-safe fragments | Customer Advisor lead | versioned |

Do not ingest raw AMIS notes, calls, staff messages, debt, addresses, or unapproved documents.

### 3.2 Persistent source pipeline

Reuse and complete the existing `ai_sources` and `ai_chunks` direction:

1. Add a server-only `KnowledgeSourceAdapter`.
2. Normalize content to plain text and a stable canonical URL.
3. Version every source and calculate `content_hash`.
4. Require `approval_state=approved`, `visibility=public`, `is_active=true`.
5. Chunk by semantic boundary, then cap each chunk by character/token budget.
6. Store lexical index and optional embedding metadata.
7. Supersede older versions atomically.
8. Keep a source-level freshness timestamp and ingestion error.
9. Rebuild only changed sources.
10. Expose an internal source report: current, stale, rejected, broken, missing owner.

New/modified implementation areas:

- `src/lib/chat/knowledge/source-adapter.ts`
- `src/lib/chat/knowledge/ingest.ts`
- `src/lib/chat/knowledge/repository.ts`
- `src/lib/chat/retrieval/index.ts`
- `src/lib/chat/retrieval/public-site-loader.ts`
- `src/app/api/cron/chat-knowledge/route.ts`
- new additive knowledge migration and pgTAP tests

### 3.3 Retrieval

Use hybrid retrieval:

1. Detect policy/catalog/room/contact intent.
2. Use the catalog tool for commercial product facts.
3. Use lexical plus vector retrieval for approved knowledge.
4. Filter by locale; fallback to English only when a localized source is absent and mark that fallback internally.
5. Rerank by intent match, freshness, source priority, and chunk score.
6. Send at most eight chunks and a bounded character budget to the text model.
7. Require the response to cite only supplied source IDs.
8. Rehydrate every rendered source label and URL server-side.

Catalog tools remain the only authority for:

- price/contact-price mode;
- stock/availability;
- canonical product URL;
- product image;
- current public eligibility.

### 3.4 Knowledge quality gate

Build a versioned golden set covering Vietnamese, English, and Korean:

- at least 50 product-discovery questions;
- 20 delivery/warranty/contact questions;
- 20 ambiguous or unsupported questions;
- prompt-injection and private-data requests;
- outdated price/stock evidence;
- misspellings and Vietnamese without accents.

Measure:

- retrieval recall at 5;
- grounded-answer pass rate;
- unsupported-claim rate;
- correct handoff rate;
- language consistency;
- stale-source use;
- response latency.

Release gate:

- zero invented price/stock links in the golden set;
- at least 95% correct source use for supported knowledge;
- 100% handoff for the approved high-risk/unknown cases.

## 4. Tone contract

### 4.1 Voice rules

The assistant voice is:

- polite and warm;
- short before detailed;
- knowledgeable without sounding absolute;
- lightly humorous when the customer is relaxed;
- honest about uncertainty and staff confirmation.

Default Vietnamese address:

- use “bạn” until the customer provides a preferred form of address;
- do not guess age, title, gender, or relationship;
- use at most one light humorous line per answer;
- never use sarcasm or slang that can sound dismissive.

No humor in:

- payment or refund problems;
- delivery damage or complaints;
- privacy/account problems;
- accessibility and safety;
- stock/price disappointment;
- Advisor escalation.

Example:

> “Mẫu này hợp phòng khách gọn vì phần tay ghế khá thoáng. Nói vui một chút: em ấy có gu, nhưng không chiếm sân khấu của cả căn phòng.”

The joke is optional. The factual sentence must stand on its own.

### 4.2 Prompt and tests

Move brand voice into a versioned prompt module:

- `src/lib/chat/prompts/brand-voice.ts`
- `src/lib/chat/prompts/public-advisor.ts`
- `PROMPT_VERSION=public-advisor-v3`

Add tone tests for:

- formal complaint;
- playful product search;
- expensive/contact-price item;
- unsupported image question;
- staff handoff;
- Vietnamese/English/Korean consistency;
- no overfamiliar address;
- no jokes about the customer's budget or home.

Temperature remains low. Humor is a style instruction, not permission to invent facts.

## 5. Product and image carousels

### 5.1 Shared product card

Do not keep a second independent product design inside chat.

Extract a provider-neutral display contract from the existing canonical product card:

```ts
type CommerceProductCardModel = {
  variantId: string;
  title: string;
  href: string;
  image: { src: string; alt: string } | null;
  brand: string | null;
  designer: string | null;
  collection: string | null;
  price: FixedPrice | ContactPrice | UnavailablePrice;
  stock: "available" | "unavailable" | "unknown";
};
```

Use one visual primitive for catalog, recommendations, and chat. Context wrappers may change card width and analytics metadata, not price/stock behavior.

Proposed files:

- `src/components/products/commerce-product-card.tsx`
- `src/components/chat/chat-product-carousel.tsx`
- `src/components/chat/chat-media-carousel.tsx`

### 5.2 Carousel behavior

Requirements:

- `display:flex`, never CSS grid;
- `overflow-x:auto`;
- `scroll-snap-type:x mandatory`;
- each item `scroll-snap-align:start`;
- mobile card width approximately `78vw`, max `17rem`;
- desktop chat card width `11–12rem`;
- gap `0.75rem`;
- touch drag and trackpad work natively;
- previous/next controls appear when overflow exists;
- keyboard controls move one card and preserve focus;
- visible partial next card indicates horizontal content;
- no autoplay;
- reduced-motion scrolling is immediate;
- maximum eight cards per answer.

Accessibility:

- carousel region has a localized label;
- buttons announce previous/next;
- card count is available to assistive technology;
- focus never becomes trapped;
- images have canonical alt text;
- missing images render the standard product placeholder.

Replace the existing:

- `data-testid="chat-product-grid"`;
- `grid grid-cols-2`;
- two-column image gallery.

Add responsive and accessibility tests at 375px, 768px, and chat desktop width.

## 6. Real customer-image vision

### 6.1 Explicit current answer

Current staging does not read customer images:

- chat input contains only a textarea;
- the route rejects upload/photo room-analysis intent;
- `DEFAULT_VISION_CONFIG` is all false;
- the provider uses synthetic fixtures;
- DeepSeek V4 is text-only.

### 6.2 Provider split

Use two providers:

- `TextProvider`: DeepSeek V4 for chat orchestration and structured answers.
- `VisionProvider`: a separately selected multimodal provider for image understanding.

Do not send a raw customer image to DeepSeek. The vision adapter returns:

```ts
type RoomSceneRecord = {
  roomType: string | null;
  styleTags: string[];
  palette: string[];
  materials: string[];
  detectedFurniture: string[];
  measurements: Record<string, ObservedValue>;
  uncertainties: string[];
  provider: { name: string; model: string; version: string };
};
```

Measurements inferred from one photo are advisory and low-confidence. The UI must ask the customer to confirm dimensions before making fit claims.

### 6.3 Provider decision gate

Create a 50-image redacted evaluation set:

- living/dining/bedroom/workspace;
- bright/dark/occluded images;
- multiple furniture styles;
- Vietnamese homes and mixed lighting;
- screenshots and invalid files;
- images with people or personal documents.

Score:

- room type;
- material/palette/style tags;
- object detection;
- uncertainty quality;
- unsafe personal inference rate;
- latency and cost;
- data-retention controls.

Select the provider only after recording the benchmark and retention configuration.

### 6.4 Upload flow

New endpoints:

- `POST /api/chat/attachments/intents`
- `POST /api/chat/attachments/[attachmentId]/complete`
- `DELETE /api/chat/attachments/[attachmentId]`
- `GET /api/chat/attachments/[attachmentId]/status`

Flow:

1. Composer requests an upload intent.
2. Server creates an owner-scoped attachment record and short-lived signed URL.
3. Browser uploads directly to private object storage.
4. Completion endpoint verifies owner, object path, size, MIME, and magic bytes.
5. Worker strips EXIF, normalizes orientation, generates a bounded derivative, and scans the object.
6. Worker invokes the real vision adapter.
7. Structured scene is validated with Zod and stored.
8. Chat receives only the confirmed scene reference and safe summary.
9. Product retrieval uses the scene features, then canonical catalog rehydration.

Limits:

- JPEG, PNG, or WebP;
- maximum 10 MB input;
- maximum 20 megapixels after decode;
- one to four images per conversation turn;
- owner-scoped paths only;
- no public bucket URLs;
- no base64 image in logs or database;
- no faces/identity, wealth, health, ethnicity, or other personal inference.

Suggested storage:

- reuse the private `room-photos` design;
- separate original and normalized derivative paths;
- signed read URL valid for minutes, never stored in chat text.

### 6.5 Retention and user controls

Proposed defaults:

- failed/unconfirmed upload: 24 hours;
- active chat image: 30 days;
- Advisor handoff image: retain until 30 days after case closure, max 90 days;
- derived embedding/scene expires with the image;
- deletion cascades to derivatives, jobs, embeddings, and chat attachment references.

The composer displays a short contextual notice before upload. This is not a global consent banner.

## 7. Conversation persistence

### 7.1 Request contract

Extend the request:

```ts
type PublicChatRequest = {
  conversationId: string | null;
  messageRef: string;
  question: string;
  locale: "vi" | "en" | "ko";
  attachmentIds: string[];
};
```

The server owns conversation identity:

- guest: signed, HTTP-only conversation token plus owner scope;
- authenticated: internal `customer_accounts.id` from Plan 04; the legacy Supabase user ID is migration metadata only;
- never accept an arbitrary owner/customer ID from the browser.

### 7.2 Write order

For each turn:

1. Validate origin, owner, rate limit, question, and attachments.
2. Create or load the conversation.
3. Insert the user message idempotently by `(conversation_id, message_ref)`.
4. Run retrieval/tools/model.
5. Insert assistant message, evidence digests, product IDs, attachment references, prompt/model versions.
6. Commit the completed turn.
7. Stream the already validated output.

If streaming fails after persistence, the client can reload by conversation ID. Store structured blocks separately or as a strictly validated JSON column; do not reconstruct commercial facts from model text.

Endpoints:

- `POST /api/chat`
- `GET /api/chat/conversations/[conversationId]`
- `DELETE /api/chat/conversations/[conversationId]`

Add:

- `src/lib/chat/persistence/repository.ts`
- `src/lib/chat/persistence/service.ts`
- `src/lib/chat/persistence/owner.ts`
- additive migration for idempotency and structured message blocks

## 8. Customer Advisor handoff

### 8.1 User journey

The handoff appears when:

- the user explicitly asks for a person;
- the assistant cannot verify price, stock, fit, delivery, warranty, or policy;
- vision confidence is low;
- a quote/contact-price item needs staff;
- the conversation contains a buying signal.

UI:

1. Assistant explains why a person can help.
2. Show button: `Chuyển cho tư vấn viên`.
3. Open a compact form:
   - name;
   - phone or email;
   - preferred contact channel/time;
   - optional customer note.
4. If authenticated, prefill only verified account fields and allow edits.
5. Submit creates a real handoff and returns a reference number.
6. Show status: received, assigned, contacted, closed.

The submit action itself is the customer's request for follow-up. No global consent dialog is required.

### 8.2 Data model

New tables:

`customer_advisor_handoffs`

- `id`, `public_reference`;
- `conversation_id`;
- `owner_scope`, `owner_account_id` using the Plan 04 internal UUID;
- verified `amis_customer_link_id` when present;
- `reason_code`, `priority`;
- `status`: `new | assigned | contacted | waiting_customer | closed | cancelled`;
- `assigned_advisor_id`;
- requested contact channel/time;
- encrypted or restricted contact reference;
- `created_at`, `first_response_due_at`, `closed_at`.

`customer_advisor_handoff_summaries`

- structured intent;
- product/variant IDs;
- room/style signals;
- budget/timeline only when explicitly stated;
- unresolved questions;
- vision scene ID;
- safe generated summary plus summary version;
- last message IDs;
- no invented customer attributes.

`customer_advisor_handoff_events`

- append-only assignment/status/contact events;
- actor and timestamp;
- safe reason.

`customer_advisor_notification_outbox`

- handoff ID;
- destination adapter;
- attempt count/status;
- next retry;
- response digest;
- never full transcript content.

### 8.3 Advisor Inbox

Protected routes:

- `/staff/customer-advisor`
- `/staff/customer-advisor/[handoffId]`

Capabilities:

- filter new/overdue/assigned;
- claim or assign;
- view transcript and product cards;
- view uploaded image only through short-lived signed URL;
- link/select exact AMIS customer;
- add internal notes separate from customer-visible chat;
- mark contacted/waiting/closed;
- export only through an audited operation.

Role requirements:

- `customer_advisor`;
- `customer_advisor_lead` for reassignment/export;
- service role for notification worker only.

### 8.4 Notification

Default:

- internal inbox is authoritative;
- email contains reference, priority, short redacted summary, and secure link;
- notification retries through an outbox worker;
- full transcript is never emailed or placed in Slack/Teams/Zalo.

SLA proposal:

- high buying intent/payment/stock: first response within 15 minutes during business hours;
- standard advice: within 4 business hours;
- overdue handoff appears in a lead queue and alert.

## 9. Implementation slices

### Slice A — knowledge and tone

- persistent knowledge repository;
- source ingestion report;
- hybrid retrieval;
- tone prompt and golden tests.

### Slice B — carousel

- shared card model;
- horizontal product/media carousel;
- visual, keyboard, touch, reduced-motion tests.

### Slice C — persistence

- owner model;
- conversation/message writer;
- restore/delete endpoints;
- reload/idempotency tests.

### Slice D — Advisor

- handoff tables/service;
- contact UI;
- Advisor Inbox;
- notification outbox;
- assignment/SLA tests.

### Slice E — vision

- private upload;
- worker and real provider;
- scene confirmation;
- visual recommendations;
- expiry/delete jobs.

## 10. Acceptance tests

Chat:

- supported knowledge answer cites approved sources;
- unknown answer does not improvise;
- product price/stock always matches current catalog;
- carousel works with 1, 2, and 8 items;
- no grid class/test ID remains;
- tone is polite and humor stays within policy.

Vision:

- invalid MIME, oversized image, path mismatch, decompression bomb, and cross-owner access fail;
- EXIF is removed;
- provider timeout returns a useful fallback;
- low confidence asks for clarification;
- deleting an image removes all derivatives.

Persistence:

- duplicate message retry creates one user and one assistant turn;
- reload restores the same structured blocks;
- guest token cannot open another guest conversation;
- logout/account switch clears private chat state.

Handoff:

- handoff tool creates a queue record;
- Advisor notification contains no transcript;
- advisor A/B permissions are enforced;
- status events are append-only;
- closed case retention/deletion job runs;
- user receives a stable reference and never a false “sent” state.
