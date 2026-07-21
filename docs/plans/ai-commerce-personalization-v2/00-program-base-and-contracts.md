# Plan 00 — Program Base, Database Baseline, and Frozen Contracts

Branch: serial preparation on a reviewed temporary branch, merged before any feature worktree is created

Status: implemented locally; shared-environment deployment blocked pending the read-only evidence bundle in the Plan 00 handoff.

## Outcome

Produce one reproducible, committed, pushed program base that every feature lane can trust. This is a blocking gate, not optional cleanup.

At completion:

- local migrations have one unambiguous forward order;
- clean-reset and existing-environment migration paths are separate and tested;
- staging/production migration ledgers are inventoried without mutation;
- catalog visibility and commercial state have one canonical contract;
- shared feature ports and public DTO fixtures are frozen;
- migration ranges and shared-file ownership are reserved;
- `<PROGRAM_BASE_SHA>` is recorded and used to create Worktree 01.

## Current hazards to resolve

1. `main` is ahead of `origin/main`; choosing local or remote main independently would produce incompatible worktrees.
2. `docs/` and `outputs/` are untracked. Worktrees created from `HEAD` would not see the plans, and unrelated output artifacts must not be accidentally committed.
3. Duplicate migration version prefixes currently exist:

   - `20260710000003_add_amis_inventory_availability.sql`
   - `20260710000003_add_korean_read_columns.sql`
   - `20260711000000_add_korean_backfill_audit.sql`
   - `20260711000000_use_strict_amis_inventory_cutoff.sql`

4. The repository migration chain does not clearly reconstruct the original catalog from an empty database.
5. PDP and search have historically disagreed on `approved` versus `validated` visibility.
6. Production/staging migration ledgers and schema fingerprints have not been established in this planning pass.

## Required database preflight

### Read-only inventory

For each intended Supabase environment:

1. identify project reference and environment owner;
2. establish an approved backup/recovery point;
3. export applied migration versions and checksums where available;
4. capture a schema fingerprint for relevant tables, functions, policies and grants;
5. map each applied remote change to a local migration or documented historical baseline;
6. record discrepancies without applying repair operations.

No already-applied migration may be renamed or edited. Resolve unapplied collisions by new unique versions. Resolve applied discrepancies by forward-repair migration or a separately reviewed ledger repair backed by evidence.

### Two mechanically separate paths

**Clean-reset path**

- Starts from an empty ephemeral/local database.
- Applies a catalog bootstrap approved for new databases.
- Applies the forward migration chain.
- Runs schema, RLS, function and representative query tests.
- Must not be callable accidentally against a linked staging/production project.

**Existing-environment forward path**

- Never runs a migration marked local-only/bootstrap against a shared database.
- Verifies existing objects against the baseline fingerprint.
- Uses additive forward migrations for any mismatch.
- Applies only after backup, review and dry-run evidence.

## Canonical catalog and commercial-state contract

Define a database view/function plus TypeScript adapter that every feature consumes. At minimum it decides:

- publish/approval/validation eligibility;
- product, variant and brand visibility;
- special hidden-brand/SKU exceptions;
- locale name and slug fallback;
- canonical product/variant identity;
- price mode: `fixed`, `contact`, `deposit`, `unavailable`;
- current display price and freshness timestamp;
- stock signal, source timestamp and stale behavior;
- usable canonical image/URL requirements;
- whether the item may be recommended, visually matched, added to cart and paid online.

No feature branch may copy these filters into its own query.

## Frozen public contracts

### Customer context

```ts
type ServerCustomerContext = {
  visitorId: string;
  sessionId: string;
  userId: string | null;
  locale: "vi" | "en" | "ko";
  consent: {
    analytics: boolean;
    personalization: boolean;
    aiProcessing: boolean;
    aiConversationStorage: boolean;
    roomImageProcessing: boolean;
    roomImageStorage: boolean;
    version: string;
  };
};

type ClientCustomerContext = {
  locale: ServerCustomerContext["locale"];
  consent: ServerCustomerContext["consent"];
  capabilities: Record<string, boolean>;
};
```

Visitor/session identifiers are HttpOnly and never serialized into the client context.

### Placement-specific recommendation request

```ts
type RecommendationRequest =
  | { placement: "pdp" | "chat"; contextVariantIds: [string]; locale: string }
  | { placement: "cart"; contextVariantIds: string[]; locale: string }
  | { placement: "home"; contextVariantIds: []; locale: string; preferenceKeys?: string[] }
  | { placement: "room"; contextVariantIds: []; locale: string; roomSceneId: string };
```

### Recommendation response

```ts
type RecommendationResponse = {
  requestId: string;
  algorithmVersion: string;
  placement: string;
  generatedAt: string;
  fallbackTier: string;
  items: Array<{ variantId: string; reasonCode: string }>;
};
```

### Customer memory

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

The DTO intentionally excludes raw names/contact details, address, identity documents, bank/debt fields and internal notes.

### Room scene

```ts
type RoomScene = {
  analysisId: string;
  roomType: string | null;
  styleTags: string[];
  palette: string[];
  materials: string[];
  detectedFurniture: string[];
  lightingTags: string[];
  userMeasurements: Record<string, number>;
  constraints: string[];
  uncertainties: string[];
  confidence: number;
  providerVersion: string;
};
```

### Visual similarity

```ts
type VisualSimilarityResponse = {
  requestId: string;
  modelId: string;
  modelVersion: string;
  queryImageHash: string;
  neighbors: Array<{ variantId: string; imageId: string }>;
};
```

Scores remain server-internal and all neighbors are rechecked through `CatalogEligibility`.

### Commerce IDs and state separation

Every paid order links the final successful ZaloPay attempt to four immutable identifiers:

```ts
type CommerceReferences = {
  webOrderId: string;
  amisSaleOrderId: string | null;
  zaloPayAppTransId: string | null;
  zaloPayTransactionId: string | null;
};
```

Earlier expired/unpaid ZaloPay attempts remain in the attempt ledger. Order, payment, inventory confirmation, AMIS sync and refund states remain separate fields/state machines.

## Shared file ownership

| Path or concern | Owner |
| --- | --- |
| Catalog eligibility SQL and `src/lib/catalog/eligibility.ts` | Program base |
| Public cross-feature contracts and fixtures | Program base; later integration only |
| `src/app/providers.tsx` | Worktree 01 initially; Worktree 08 final composition |
| `src/lib/remote-read-only.ts` capability factory | Worktree 01 |
| `src/types/database.types.ts` | Worktree 08 only |
| `messages/*.json`, `src/lib/env.ts`, `.env.example`, `vercel.json` | Worktree 08 only |
| `package.json`, `pnpm-lock.yaml` | Worktree 08 unless one approved feature dependency is unavoidable |
| Shared `ProductCard`/mapper locale and instrumentation reconciliation | Worktree 08 |

## Reserved migration lanes

Choose versions after inspecting the final latest migration. Reserve non-overlapping prefixes, for example:

- foundation: `YYYYMMDD01xxxx_*`
- commerce: `YYYYMMDD02xxxx_*`
- AMIS customer memory: `YYYYMMDD03xxxx_*`
- chatbot/RAG: `YYYYMMDD04xxxx_*`
- recommendations: `YYYYMMDD05xxxx_*`
- vision: `YYYYMMDD06xxxx_*`
- personalization: `YYYYMMDD07xxxx_*`
- integration/forward repair: `YYYYMMDD08xxxx_*`

Use the actual UTC date when implementation begins. Do not copy the placeholder date blindly.

## Worktree creation preconditions

- canonical base branch is clean;
- plans intended for implementers are committed;
- unrelated `outputs/` artifacts are excluded or handled separately;
- database ledger evidence is recorded;
- tests for catalog eligibility pass;
- generated types match the reconciled schema;
- base commit is pushed or otherwise durably available;
- `<PROGRAM_BASE_SHA>` is recorded in the README and Worktree 01 plan.

## Verification commands

Run the commands supported by the repository at implementation time:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
git diff --check
```

Database tests include clean-reset reconstruction, forward-only existing-environment simulation, canonical eligibility fixtures and RLS/grant inspection.

## Definition of done

- no duplicate migration version remains in the implementation chain;
- no applied shared-environment migration was modified;
- clean-reset and existing-environment paths are documented and tested separately;
- one catalog eligibility contract is consumed by fixture tests for commerce, chat, recommendations and vision;
- contract fixtures compile without importing unfinished feature internals;
- file ownership and migration ranges are recorded;
- `<PROGRAM_BASE_SHA>` is committed and ready for Worktree 01.

## Implementation record (2026-07-21 UTC)

### Local evidence and collision disposition

- Implementation started from tracked plan commit `b72872fceb4adf1342c816ef6b83e7096241f56c`; its merge base with `origin/main` is `e920ab95b73cc80cac971e8ed7fb1afff1866db7`.
- `20260710000003_add_amis_inventory_availability.sql` and `20260710000003_add_korean_read_columns.sql` remain byte-for-byte untouched.
- `20260711000000_add_korean_backfill_audit.sql` and `20260711000000_use_strict_amis_inventory_cutoff.sql` remain byte-for-byte untouched.
- Historical commit `c680c8f1dfa4bc9e490d90fcdd39bd97459e5d17` restored a catalog baseline by renaming colliding migrations. Plan 00 deliberately does not reuse that rename strategy.
- The native tracked migration chain cannot reset an empty database because it first references `public.variants` before creating catalog tables. `supabase/plan00-local/run-clean-reset.sh` is the only clean-local recovery path: it creates a temporary workdir, prepends the catalog baseline, accepts no arguments, and invokes only `supabase db reset --local --no-seed`.
- Existing-environment forward path: retain its current catalog baseline and apply only the additive `20260721010000_plan00_catalog_eligibility.sql` after the external evidence gate. Never run the local harness or bootstrap SQL against a linked/shared project.

### Canonical eligibility and ownership

`public.catalog_eligibility` is the Plan 00 canonical read model. It preserves approval and validation as independent gates, treats unknown/stale/non-positive inventory and non-fixed pricing as ineligible for paid commerce, excludes hidden Moooi brand/SKU rows, applies locale-name fallback, and exposes storefront, recommendation, visual-match, cart, and payment booleans with reason codes. `src/lib/catalog/eligibility.ts` is the generated-type-independent Zod boundary for that view. Existing feature queries remain legacy adoption work for Plans 02–08.

| Path or concern | Plan 00 owner | Downstream rule |
| --- | --- | --- |
| `public.catalog_eligibility` and its pgTAP test | Program base | Consume; do not duplicate policy |
| `src/lib/catalog/eligibility.ts` | Program base | Consume parsed DTO/predicates |
| `src/lib/contracts/*` | Program base | Extend only through integration approval |
| local catalog recovery harness | Program base | Local ephemeral use only |
| generated database types, global providers, env, messages, lockfile | Plan 08 | Not changed in Plan 00 |

### Reserved migration lanes

The actual Plan 00 forward migration is `20260721010000_plan00_catalog_eligibility.sql`. The existing historical duplicate versions are reserved historical artifacts, not an available lane. Subsequent work uses non-overlapping UTC prefixes after `20260721010000`: Plan 01 `2026072102xxxx`, Plan 02 `2026072103xxxx`, Plan 03 `2026072104xxxx`, Plan 04 `2026072105xxxx`, Plan 05 `2026072106xxxx`, Plan 06 `2026072107xxxx`, Plan 07 `2026072108xxxx`, Plan 08 `2026072109xxxx`.

### Required shared-environment evidence gate

No staging/production migration or deployment is authorized by this commit. Before any shared-environment forward migration, the operator must attach to the Plan 00 handoff: project ref/environment name, owner and approval timestamp; a read-only migration-ledger export with versions/checksums; catalog/commerce schema fingerprint (tables, columns, functions, policies, and grants); a comparison to the committed migration inventory and final Program Base SHA; an approved backup/recovery point; and documented discrepancy disposition. Missing evidence is a hard stop, not a reason to use the local bootstrap.
