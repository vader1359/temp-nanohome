# Plan: Audit and Correct Product Dimensions from Names with DeepSeek

## Objective

Replace unreliable catalog `size` values with dimensions extracted from the authoritative product names, while preserving a reviewable audit trail and never overwriting an ambiguous result automatically.

The live catalog currently contains 1,195 `products` and 2,323 `variants`. Both tables have an independent `size` field, so the correction must cover both levels.

## Scope and source-of-truth rules

| Record | Text sent for extraction | Field that may be corrected | Rule |
| --- | --- | --- | --- |
| Variant | `variants.name` (plus SKU and parent product name only as context) | `variants.size` | This is the canonical sellable configuration. Extract every explicit dimension in its own name. |
| Product | `products.name` plus the canonical sizes of its variants | `products.size` | Use the product-name dimension only when explicit. Otherwise derive a display range/list from approved variant dimensions; do not copy an arbitrary variant. |

- Product names, not translated names, are the primary evidence. `name_vi`, `name_ko`, descriptions, images, current `size`, and `raw` data are context-only and must never cause the model to invent a measurement.
- Values with no stated dimensions remain `null`/empty and are marked `not_found`; they are not guessed from product category, SKU, image, or another product.
- Canonical output is `W… x D… x H… mm` (for example, `W2500 x D200 x H500 mm`). Emit the applicable primary axes in that order; for genuinely round products use `Ø… x H… mm` rather than inventing width/depth.
- Convert all explicit source units to millimetres before output: `cm × 10`, `m × 1000`, and `in × 25.4`. Preserve the source value/unit in the audit record and use a non-rounded decimal mm result where conversion is not integral.
- Keep explicit secondary measurements after the primary dimensions in parentheses, for example `W600 x D550 x H820 mm (SH450 mm)`. Supported labels include `SH`, `AH`, `DH`, `TH`, `CL`, `Ø`, and a source-supported range; never infer an auxiliary measurement.

## Deliverables

1. A timestamped read-only catalog snapshot and a normalized input JSONL keyed by immutable `id`/`sku`.
2. A DeepSeek extraction artifact containing the raw source name, structured result, model/version, prompt version, timestamps, attempt count, and status for every record.
3. A CSV/JSON review report separating automatic candidates, unchanged values, missing dimensions, ambiguous names, parse failures, and suspicious changes.
4. A dry-run patch manifest with before/after values and an executable rollback manifest.
5. A gated apply command and post-apply verification report.

## Implementation phases

### 1. Snapshot and baseline audit

1. Add a read-only script under `scripts/` that pages through `products` and `variants` from Supabase using the server-only credentials already used by catalog scripts.
2. Save a timestamped snapshot under `outputs/product-size-audit/<timestamp>/`; include IDs, SKU, parent relationship, names, current `size`, and `updated_at` only. Do not log secrets.
3. Classify the existing sizes before asking DeepSeek: missing, valid-looking, malformed, duplicated across unrelated variants, and conflicting with a dimension token already present in the name.
4. Report counts by table, brand, category/product line, and failure reason. This establishes the exact set to remediate rather than assuming every non-empty size is wrong.

### 2. Deterministic pre-parser

1. Implement a strict lexical parser for dimensions in names (for example `W1600 x D800 x H720 mm`, `Ø 430 mm`, `L 160–200 cm`, `200x300 cm`, and `SH 45 cm`).
2. Normalize to the catalog contract: map unambiguous source axes into primary `W x D x H` order, convert source units to `mm`, and render the lowercase separator ` x `. Record the original tokens and conversion in the audit artifact; do not silently discard an axis or an auxiliary measurement.
3. When a source has dimensions but no reliable axis labels (such as `200 x 300 cm`), preserve the ordered values as source order in the proposed display and route it to manual review instead of assuming which one is W/D/H.
4. Give a deterministic extraction a `high` confidence only when all numeric dimension tokens and units are unambiguous. Send all other names to DeepSeek, including conflicting/multiple dimension sequences.
5. Retain the parser result as independent evidence; DeepSeek must not be trusted as the only source or asked to calculate dimensions.

### 3. DeepSeek structured extraction

1. Reuse the existing server-only DeepSeek request discipline in `src/lib/korean-backfill/deepseek.ts`: timeout, bounded retry for 429/5xx or invalid JSON, JSON-only response, and Zod validation. Create a size-specific client/schema rather than changing Korean translation behavior.
2. Process bounded batches with stable record indexes. The request contains only catalog identifiers and names; it contains no customer, order, or credential data.
3. Require this strict response per item:

   ```json
   {
     "id": "uuid-or-sku",
     "status": "extracted | not_found | ambiguous",
     "dimensions": [
       { "axis": "W", "value_mm": 1600 },
       { "axis": "D", "value_mm": 800 },
       { "axis": "H", "value_mm": 720 },
       { "axis": "SH", "value_mm": 450 }
     ],
     "display_size": "W1600 x D800 x H720 mm (SH450 mm)",
     "evidence": "exact substring from the supplied name",
     "confidence": "high | medium | low"
   }
   ```

4. Validate that every axis/value in `display_size` is supported by `evidence` in the original name, and independently recompute every unit conversion. Rebuild the final string from the verified structured axes (primary `W`, `D`, `H`; then auxiliary values) rather than trusting the model's axis order or punctuation. Reject invented/altered values, unsupported units, duplicate IDs, missing IDs, malformed JSON, and non-finite numbers. Retry malformed provider output up to the existing retry limit.

### 4. Reconcile and review gate

1. Join output only by immutable `variants.id` / `products.id` (and SKU as a human-readable secondary key); never join by display name.
2. Mark a variant `ready_to_apply` only when the deterministic parser and DeepSeek agree, or DeepSeek returns high confidence with exact evidence and a valid structured result.
3. Force manual review for: multiple unrelated size sequences, unitless dimensions, a range/composition that cannot map cleanly, conflict between parser and model, low/medium confidence, a large magnitude change, or a product-level aggregation that differs across variants.
4. Build product-level values only after variant review: explicit product-name dimensions win; otherwise form a clearly labelled deduplicated list/range of approved variant sizes. Do not replace a product size with a guessed “standard” size.
5. Produce review CSVs with `record_id`, SKU, source name, old size, proposed size, evidence, parser result, model result, confidence, reason, and selected action. Nothing writes to Supabase in this phase.

### 5. Controlled apply and rollback

1. Require an explicit `--apply` flag and a reviewed manifest; default behavior is dry-run. Refuse to apply a manifest whose snapshot hash or record `updated_at` values are stale.
2. Back up the exact affected rows immediately before mutation, then update in small idempotent batches with a conditional `updated_at` check.
3. Update only `size` for approved IDs. Store provenance in the existing JSON `raw` field only if the schema/operations owner approves that convention; otherwise retain the audit artifact externally rather than changing unrelated schema.
4. On partial failure, stop, report unmodified/modified IDs, and use the rollback manifest to restore only successfully changed rows.

### 6. Verification and handoff

1. Re-read every applied row and compare it byte-for-byte with the approved manifest.
2. Re-run the lexical validator against the new `size`, verify no unreviewed IDs changed, and check that product pages render the expected field without a build/type regression.
3. Run focused unit tests for parser, DeepSeek response validation, reconciliation, stale-manifest protection, dry-run, apply, and rollback. Then run the relevant existing test suite.
4. Deliver the summary with totals: scanned, extracted deterministically, extracted by DeepSeek, unchanged, manual-review, applied, rejected, and rolled back (if any), plus links to the immutable artifacts.

## Acceptance criteria

- All 2,323 variants and 1,195 products are scanned from a single recorded snapshot.
- Every written primary size uses the canonical `W x D x H mm` form where those axes are present; explicit auxiliary values (such as `SH`) follow in parentheses, and all unit conversions are reproducible from the recorded source.
- No measurement is written unless it is supported by the exact original name and passes the schema/evidence validation.
- Every changed row has an ID-keyed before/after record and can be rolled back without touching unrelated catalog data.
- Ambiguous and missing-name cases are visible in a review queue, not silently guessed or erased.
- Existing Korean translation and BeB import workflows remain unchanged; the prior BeB DeepSeek artifact is reference evidence only, not an authority for the whole catalog.
