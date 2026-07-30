import { describe, expect, it } from "vitest";

import { buildPublicChatTelemetry } from "./observability";
import { parseShoppingIntent } from "./shopping-intent";

describe("public chat observability", () => {
  it("records bounded structured filters and timings without the raw question", () => {
    const question = "Bàn của USM dưới 100 triệu";
    const telemetry = buildPublicChatTelemetry({
      intent: parseShoppingIntent(question, "vi"),
      catalogRevision: "staging-catalog-r1",
      resultCount: -3,
      timing: {
        intentMs: 1.6,
        retrievalMs: 42.4,
        firstBlockMs: -2,
        finalMs: Number.POSITIVE_INFINITY,
      },
      fallbackCode: "provider_error".repeat(20),
    });

    expect(telemetry.queryFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(telemetry.catalogRevision).toBe("staging-catalog-r1");
    expect(telemetry.intentKind).toBe("product_search");
    expect(telemetry.appliedFilters).toMatchObject({
      availability: "include_unknown",
      limit: 8,
      productFamilies: ["table"],
      brands: ["usm"],
      maxPrice: 100_000_000,
    });
    expect(telemetry.resultCount).toBe(0);
    expect(telemetry.timing).toEqual({ intentMs: 2, retrievalMs: 42, firstBlockMs: 0, finalMs: 0 });
    expect(telemetry.fallbackCode).toHaveLength(80);

    const serialized = JSON.stringify(telemetry);
    expect(serialized).not.toContain(question);
    expect(serialized).not.toMatch(/deepseek|api[_ -]?key|secret/i);
  });
});
