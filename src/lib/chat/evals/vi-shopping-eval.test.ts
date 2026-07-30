import { describe, expect, it } from "vitest";

import {
  evaluateVietnameseShoppingCase,
  evaluateVietnameseShoppingMatrix,
  summarizeVietnameseShoppingEval,
} from "./vi-shopping-eval";
import { getVietnameseShoppingCase, viShoppingCases } from "./vi-shopping-cases";

describe("Vietnamese shopping evaluation matrix", () => {
  it("keeps the owner-selected case ids unique and machine-checkable", () => {
    const ids = viShoppingCases.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      "AI-PROD-001",
      "AI-PROD-010",
      "AI-FLT-001",
      "AI-FLT-010",
      "AI-REC-002",
      "AI-DET-001",
      "AI-CMP-001",
      "AI-NO-001",
      "AI-SEC-001",
    ]));
  });

  it("passes all intent/filter assertions without assuming catalog facts", () => {
    const reports = evaluateVietnameseShoppingMatrix(viShoppingCases);

    expect(reports).toHaveLength(viShoppingCases.length);
    expect(reports.filter((report) => !report.passed)).toEqual([]);
    expect(reports.every((report) => report.cardCount === 0)).toBe(true);
  });

  it("rejects a lamp returned for a table-only request", () => {
    const item = getVietnameseShoppingCase("AI-PROD-001");
    if (item === undefined) throw new Error("missing AI-PROD-001");

    const report = evaluateVietnameseShoppingCase(item, {
      records: [{ variantId: "lamp-01", familyKeys: ["lamp"] }],
    });

    expect(report.passed).toBe(false);
    expect(report.failures).toContain("record:forbidden:lamp");
  });

  it("keeps collection constraints separate from product-family constraints", () => {
    const item = getVietnameseShoppingCase("AI-FLT-009");
    if (item === undefined) throw new Error("missing AI-FLT-009");

    const report = evaluateVietnameseShoppingCase(item, {
      records: [{ variantId: "lc-table", collectionKeys: ["lc"] }],
    });

    expect(report.passed).toBe(true);
  });

  it("rejects contact-price or unknown-stock records for bounded available queries", () => {
    const item = getVietnameseShoppingCase("AI-FLT-003");
    if (item === undefined) throw new Error("missing AI-FLT-003");

    const report = evaluateVietnameseShoppingCase(item, {
      records: [{
        variantId: "sofa-contact",
        familyKeys: ["sofa"],
        price: 1,
        priceMode: "contact",
        stockState: "unknown",
      }],
    });

    expect(report.passed).toBe(false);
    expect(report.failures).toContain("record:maxPrice:sofa-contact");
  });

  it("enforces per-case latency budgets and reports a P95 sample", () => {
    const fast = evaluateVietnameseShoppingMatrix(viShoppingCases.slice(0, 3), {
      latencyMsByCaseId: {
        "AI-PROD-001": 120,
        "AI-PROD-002": 240,
        "AI-PROD-003": 360,
      },
    });
    expect(fast.every((report) => report.passed)).toBe(true);
    expect(summarizeVietnameseShoppingEval(fast)).toMatchObject({
      totalCases: 3,
      passedCases: 3,
      passRate: 1,
      latencySamples: 3,
      p95LatencyMs: 360,
    });

    const slow = evaluateVietnameseShoppingCase(viShoppingCases[0]!, { latencyMs: 6_001 });
    expect(slow.passed).toBe(false);
    expect(slow.failures).toContain("latency:max");
  });
});
