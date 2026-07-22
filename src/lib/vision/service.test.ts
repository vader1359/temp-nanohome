import { describe, expect, it } from "vitest";
import type { CatalogEligibility } from "../catalog/eligibility";
import { createSyntheticVisionProvider } from "./provider";
import type { EmbeddingCandidate } from "./retrieval";
import { orchestrateLocalVisionRetrieval } from "./service";

const eligibleRow = (variantId: string, overrides: Partial<CatalogEligibility> = {}): CatalogEligibility => ({
  variant_id: variantId,
  product_id: "product-1",
  brand_id: "brand-1",
  sku: `sku-${variantId}`,
  variant_slug: variantId,
  variant_name: "Synthetic chair",
  localized_name: "Synthetic chair",
  product_slug: "synthetic-chair",
  product_name: "Synthetic chair",
  localized_product_name: "Synthetic chair",
  brand_slug: "synthetic",
  brand_name: "Synthetic",
  image_url: "https://example.invalid/synthetic.jpg",
  price: 100,
  stock: 2,
  price_mode: "fixed",
  has_fresh_stock: true,
  has_supported_media: true,
  catalog_approved_validated: true,
  hidden_brand_sku: false,
  reason_codes: [],
  storefront: true,
  recommendation: true,
  visual_match: true,
  cart: true,
  payment: true,
  ...overrides,
});

const candidate = (variantId: string, overrides: Partial<EmbeddingCandidate> = {}): EmbeddingCandidate => ({
  variantId,
  productImageId: `image-${variantId}`,
  embedding: [0.125, 0.25, 0.5],
  model: { provider: "synthetic", modelId: "fixture-vector", version: "1", dimensions: 3 },
  visualDistance: 0.1,
  eligibility: eligibleRow(variantId),
  ...overrides,
});

const readyOutcome = () => createSyntheticVisionProvider().analyze({ objectReference: "opaque-local-object", fixture: "ready" });

describe("local vision retrieval orchestration", () => {
  it("returns canonical visual and room-fit IDs when a ready local outcome has confirmed signals", () => {
    // Given
    const outcome = readyOutcome();

    // When
    const result = orchestrateLocalVisionRetrieval({
      requestReference: "request-local-1",
      outcome,
      candidates: [candidate("far", { visualDistance: 0.8 }), candidate("near", { visualDistance: 0.2 })],
      confirmedScene: true,
      explicitMeasurements: ["chairWidth"],
      roomSignals: ["living_room"],
    });

    // Then
    expect(result).toEqual({
      kind: "ready",
      visual: {
        candidates: [
          { variantId: "near", reasonCodes: ["visually_similar"] },
          { variantId: "far", reasonCodes: ["visually_similar"] },
        ],
        rejected: [],
      },
      roomFit: {
        candidates: [
          { variantId: "far", reasonCodes: ["room_fit", "confirmed_scene", "explicit_measurement", "room_signal_match"] },
          { variantId: "near", reasonCodes: ["room_fit", "confirmed_scene", "explicit_measurement", "room_signal_match"] },
        ],
        rejected: [],
      },
    });
  });

  it("suppresses room-fit claims when no room signals are supplied", () => {
    // Given
    const outcome = readyOutcome();

    // When
    const result = orchestrateLocalVisionRetrieval({
      requestReference: "request-local-2",
      outcome,
      candidates: [candidate("kept")],
      confirmedScene: false,
      explicitMeasurements: [],
      roomSignals: [],
    });

    // Then
    expect(result).toEqual({
      kind: "ready",
      visual: { candidates: [{ variantId: "kept", reasonCodes: ["visually_similar"] }], rejected: [] },
      roomFit: { candidates: [], rejected: [{ variantId: "kept", reasonCode: "room_signals_required" }] },
    });
  });

  it("preserves visual filtering while keeping incompatible, hidden, stale, and duplicate candidates out", () => {
    // Given
    const outcome = readyOutcome();

    // When
    const result = orchestrateLocalVisionRetrieval({
      requestReference: "request-local-3",
      outcome,
      candidates: [
        candidate("kept", { visualDistance: 0.2 }),
        candidate("incompatible", { model: { provider: "other", modelId: "fixture-vector", version: "1", dimensions: 3 } }),
        candidate("hidden", { eligibility: eligibleRow("hidden", { visual_match: false }) }),
        candidate("stale", { eligibility: eligibleRow("stale", { has_fresh_stock: false }) }),
        candidate("duplicate", { productImageId: "image-kept" }),
      ],
      confirmedScene: true,
      explicitMeasurements: [],
      roomSignals: [],
    });

    // Then
    expect(result).toEqual({
      kind: "ready",
      visual: {
        candidates: [{ variantId: "kept", reasonCodes: ["visually_similar"] }],
        rejected: [
          { variantId: "incompatible", reasonCode: "provider_mismatch" },
          { variantId: "hidden", reasonCode: "ineligible" },
          { variantId: "stale", reasonCode: "stale" },
          { variantId: "duplicate", reasonCode: "duplicate" },
        ],
      },
      roomFit: {
        candidates: [
          { variantId: "kept", reasonCodes: ["room_fit", "confirmed_scene"] },
          { variantId: "hidden", reasonCodes: ["room_fit", "confirmed_scene"] },
        ],
        rejected: [
          { variantId: "incompatible", reasonCode: "provider_mismatch" },
          { variantId: "stale", reasonCode: "stale" },
          { variantId: "duplicate", reasonCode: "duplicate" },
        ],
      },
    });
  });

  it.each([
    ["provider failure", "provider_failure", { kind: "unavailable", reasonCode: "provider_unavailable" }],
    ["low confidence", "low_confidence", { kind: "failed", reasonCode: "analysis_failed" }],
    ["malformed output", "malformed", { kind: "failed", reasonCode: "analysis_failed" }],
  ] as const)("returns safe %s metadata without provider details", (_label, fixture, expected) => {
    // Given
    const outcome = createSyntheticVisionProvider().analyze({ objectReference: "data:image/png;base64,private", fixture });

    // When
    const result = orchestrateLocalVisionRetrieval({
      requestReference: "request-local-4",
      outcome,
      candidates: [candidate("never-exposed")],
      confirmedScene: true,
      explicitMeasurements: ["chairWidth"],
      roomSignals: ["living_room"],
    });

    // Then
    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain("data:image");
    expect(JSON.stringify(result)).not.toContain("embedding");
    expect(JSON.stringify(result)).not.toContain("fixture-vector");
  });

  it("sanitizes requestReference to prevent echoing sensitive raw references like data URIs, signed URLs, or internal provider paths", () => {
    const outcome = readyOutcome();

    const sensitiveInputs = [
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "https://storage.supabase.co/v1/object/sign/room-photos/user1/scene1.png?token=secret123",
      "vision/internal/provider/path/secret-file.png",
    ];

    for (const rawReference of sensitiveInputs) {
      const result = orchestrateLocalVisionRetrieval({
        requestReference: rawReference,
        outcome,
        candidates: [candidate("kept")],
        confirmedScene: true,
        explicitMeasurements: [],
        roomSignals: ["living_room"],
      });

      expect(result).not.toHaveProperty("requestReference");
      expect(JSON.stringify(result)).not.toContain("base64");
      expect(JSON.stringify(result)).not.toContain("token=secret123");
      expect(JSON.stringify(result)).not.toContain("secret-file");
    }
  });
});
