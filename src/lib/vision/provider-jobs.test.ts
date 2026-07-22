import { describe, expect, it, vi } from "vitest";
import * as vision from "./index";
import { createInMemoryVisionJobBoundary } from "./index";
import { createSyntheticVisionProvider } from "./provider";

describe("synthetic vision provider and job boundary", () => {
  it("returns a deterministic ready outcome with compatible vector metadata", () => {
    // Given: a private object reference and the ready synthetic fixture.
    const provider = createSyntheticVisionProvider();

    // When: the provider analyzes the local fixture reference.
    const result = provider.analyze({ objectReference: "vision-object-synthetic-001", fixture: "ready" });

    // Then: the safe result contains only deterministic analysis and compatible vector metadata.
    expect(result).toEqual({
      kind: "ready",
      record: {
        sceneId: "synthetic-scene-001",
        roomType: "living_room",
        styleTags: ["synthetic", "minimal"],
        palette: ["warm-white", "oak"],
        materials: ["wood"],
        detectedFurniture: ["chair"],
        measurements: { chairWidth: { value: 240, unit: "cm", source: "vision", confidence: 0.4 } },
        uncertainties: ["synthetic fixture; not a customer image"],
        analyzedAt: "2026-01-01T00:00:00.000Z",
        provider: { name: "synthetic", version: "fixture-1" },
      },
      vector: [0.125, 0.25, 0.5],
      model: { provider: "synthetic", modelId: "fixture-vector", version: "1", dimensions: 3 },
    });
  });

  it.each([
    ["low confidence", "low_confidence", "analysis_failed"],
    ["provider failure", "provider_failure", "provider_unavailable"],
  ] as const)("returns an allowlisted safe failure for %s", (_label, fixture, code) => {
    // Given: a synthetic fixture with no releasable analysis result.
    const provider = createSyntheticVisionProvider();

    // When: the provider evaluates the fixture.
    const result = provider.analyze({ objectReference: "vision-object-synthetic-001", fixture });

    // Then: no provider detail is exposed beyond the allowlisted code.
    expect(result).toEqual({ kind: "failed", code });
  });

  it("redacts malformed provider output to a safe failure", () => {
    // Given: the malformed synthetic fixture.
    const provider = createSyntheticVisionProvider();

    // When: the fixture produces an invalid internal provider result.
    const result = provider.analyze({ objectReference: "vision-object-synthetic-001", fixture: "malformed" });

    // Then: raw malformed content is absent from the safe outcome.
    expect(result).toEqual({ kind: "failed", code: "analysis_failed" });
    expect(JSON.stringify(result)).not.toContain("malformed");
  });

  it("returns the original outcome for duplicate delivery without invoking the provider twice", () => {
    // Given: a job boundary with a tracked deterministic provider.
    const provider = createSyntheticVisionProvider();
    const analyze = vi.fn(provider.analyze);
    const jobs = createInMemoryVisionJobBoundary({ analyze });
    const delivery = {
      requestId: "vision-request-synthetic-001",
      idempotencyKey: "vision-idempotency-synthetic-001",
      objectReference: "vision-object-synthetic-001",
      fixture: "ready",
    } as const;

    // When: the same delivery arrives twice.
    const first = jobs.deliver(delivery);
    const duplicate = jobs.deliver(delivery);

    // Then: the complete prior outcome is returned without a second provider call.
    expect(duplicate).toEqual(first);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it("returns analysis_failed for duplicate delivery with mismatched request attributes without re-invoking analyze", () => {
    // Given: a job boundary with an initial delivery.
    const provider = createSyntheticVisionProvider();
    const analyze = vi.fn(provider.analyze);
    const jobs = createInMemoryVisionJobBoundary({ analyze });
    const initialDelivery = {
      requestId: "vision-request-001",
      idempotencyKey: "vision-idempotency-001",
      objectReference: "vision-object-001",
      fixture: "ready",
    } as const;

    jobs.deliver(initialDelivery);
    expect(analyze).toHaveBeenCalledTimes(1);

    // When: a duplicate delivery arrives with the same identity but a different object reference.
    const mismatchedDelivery = {
      requestId: "vision-request-001",
      idempotencyKey: "vision-idempotency-001",
      objectReference: "vision-object-002",
      fixture: "ready",
    } as const;

    const outcome = jobs.deliver(mismatchedDelivery);

    // Then: a safe failure outcome is returned without invoking analyze a second time.
    expect(outcome).toEqual({ kind: "failed", code: "analysis_failed" });
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it("exports separate RoomVisionProvider and ImageEmbeddingProvider local boundaries with deterministic embedding output", () => {
    const providerModule = vision as Record<string, unknown>;
    expect(providerModule).toHaveProperty("createSyntheticRoomVisionProvider");
    expect(providerModule).toHaveProperty("createSyntheticImageEmbeddingProvider");

    const createRoomVision = providerModule.createSyntheticRoomVisionProvider as () => {
      analyzeRoom: (req: { objectReference: string; fixture: string }) => unknown;
    };
    const createImageEmbedding = providerModule.createSyntheticImageEmbeddingProvider as () => {
      embedImage: (req: { objectReference: string; fixture: string }) => { kind: string; vector?: readonly number[] };
    };

    const roomVision = createRoomVision();
    const imageEmbedding = createImageEmbedding();

    const roomOutcome = roomVision.analyzeRoom({ objectReference: "ref-room-1", fixture: "ready" });
    const embedOutcome = imageEmbedding.embedImage({ objectReference: "ref-image-1", fixture: "ready" });

    expect(roomOutcome).toHaveProperty("kind", "ready");
    expect(embedOutcome).toEqual({
      kind: "ready",
      vector: [0.125, 0.25, 0.5],
      model: { provider: "synthetic", modelId: "fixture-vector", version: "1", dimensions: 3 },
    });
  });

  it("prevents key collisions for delimiter-containing request or idempotency keys and rejects empty identity inputs", () => {
    const provider = createSyntheticVisionProvider();
    const analyze = vi.fn(provider.analyze);
    const jobs = createInMemoryVisionJobBoundary({ analyze });

    const deliveryA = {
      requestId: "req:1",
      idempotencyKey: "key2",
      objectReference: "obj-1",
      fixture: "ready",
    } as const;

    const deliveryB = {
      requestId: "req",
      idempotencyKey: "1:key2",
      objectReference: "obj-2",
      fixture: "ready",
    } as const;

    jobs.deliver(deliveryA);
    jobs.deliver(deliveryB);

    expect(analyze).toHaveBeenCalledTimes(2);

    const emptyDelivery = {
      requestId: "",
      idempotencyKey: "key",
      objectReference: "obj",
      fixture: "ready",
    } as const;

    expect(() => jobs.deliver(emptyDelivery)).toThrow();
  });
});
