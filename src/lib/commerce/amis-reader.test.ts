import { describe, expect, it } from "vitest";

import {
  assessAmisStock,
  readAmisStockLedger,
  type AmisStockPageFetcher,
} from "@/lib/commerce/amis-reader";
import { parseRawSku } from "@/lib/commerce/domain";
import {
  createAmisReadCapability,
  type AmisTenantProof,
} from "@/lib/commerce/amis-capability";

const proof: AmisTenantProof = {
  readonly: true,
  tenantId: "tenant-test",
  stockReadProven: true,
};

function pages(values: readonly unknown[]): AmisStockPageFetcher {
  return async (page) => values[page - 1];
}

describe("AMIS stock reader", () => {
  it("matches the selected warehouse by ID while retaining the observed name", async () => {
    const ledger = await readAmisStockLedger({ fetchPage: pages([{ total_pages: 1, data: [
      { product_code: "SKU", warehouse_id: "WH", warehouse_name: "Observed label", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" },
    ] }]) });

    const result = await assessAmisStock({
      ledger,
      requested: { sku: parseRawSku("SKU"), warehouseId: "WH", warehouseName: "Configured label", quantity: 1 },
      now: "2026-07-22T00:01:00.000Z",
      maxAgeMs: 120_000,
    });

    expect(result.kind).toBe("available");
  });

  it("rejects an empty raw SKU at the typed request boundary", () => {
    expect(() => parseRawSku("")).toThrow();
  });

  it("rejects duplicate raw SKU and warehouse ID even when names differ", async () => {
    const ledger = await readAmisStockLedger({ fetchPage: pages([{ total_pages: 1, data: [
      { product_code: "SKU", warehouse_id: "WH", warehouse_name: "Main", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" },
      { product_code: "SKU", warehouse_id: "WH", warehouse_name: "Renamed", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" },
    ] }]) });

    const result = await assessAmisStock({
      ledger,
      requested: { sku: parseRawSku("SKU"), warehouseId: "WH", warehouseName: "Main", quantity: 1 },
      now: "2026-07-22T00:01:00.000Z",
      maxAgeMs: 120_000,
    });

    expect(result).toEqual({ kind: "unavailable", reason: "duplicate" });
  });

  it("produces the same digest when pages arrive in a different order", async () => {
    const first = await readAmisStockLedger({ fetchPage: pages([{ total_pages: 1, data: [
      { product_code: "SKU-A", warehouse_id: "WH-A", warehouse_name: "A", amount_summary: 1, observed_at: "2026-07-22T00:00:00.000Z" },
      { product_code: "SKU-B", warehouse_id: "WH-B", warehouse_name: "B", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" },
    ] }]) });
    const second = await readAmisStockLedger({ fetchPage: pages([{ total_pages: 1, data: [
      { product_code: "SKU-B", warehouse_id: "WH-B", warehouse_name: "B", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" },
      { product_code: "SKU-A", warehouse_id: "WH-A", warehouse_name: "A", amount_summary: 1, observed_at: "2026-07-22T00:00:00.000Z" },
    ] }]) });

    expect(first.kind).toBe("success");
    expect(second.kind).toBe("success");
    if (first.kind !== "success" || second.kind !== "success") return;
    expect(first.ledger.digest).toBe(second.ledger.digest);
  });

  it("consumes every declared page and preserves raw SKU and warehouse values", async () => {
    const result = await readAmisStockLedger({
      fetchPage: pages([
        { total_pages: 2, data: [{ product_code: " SKU-1 ", warehouse_id: " WH-1 ", warehouse_name: "Main", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" }] },
        { total_pages: 2, data: [{ product_code: "SKU-1", warehouse_id: "WH-1", warehouse_name: "Main", amount_summary: 3, observed_at: "2026-07-22T00:00:01.000Z" }] },
      ]),
    });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.sku).toBe(" SKU-1 ");
    expect(result.records[1]?.sku).toBe("SKU-1");
  });

  it("fails closed for duplicate, missing, malformed, stale, and insufficient records", async () => {
    const duplicate = await assessAmisStock({
      ledger: await readAmisStockLedger({ fetchPage: pages([{ total_pages: 1, data: [
        { product_code: "SKU", warehouse_id: "WH", warehouse_name: "Main", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" },
        { product_code: "SKU", warehouse_id: "WH", warehouse_name: "Main", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" },
      ] }]) }),
      requested: { sku: parseRawSku("SKU"), warehouseId: "WH", warehouseName: "Main", quantity: 1 },
      now: "2026-07-22T00:01:00.000Z",
      maxAgeMs: 120_000,
    });
    expect(duplicate.kind).toBe("unavailable");

    const ledger = await readAmisStockLedger({ fetchPage: pages([{ total_pages: 1, data: [
      { product_code: "SKU", warehouse_id: "WH", warehouse_name: "Main", amount_summary: 1, observed_at: "2026-07-21T00:00:00.000Z" },
    ] }]) });
    const base = { ledger, requested: { sku: parseRawSku("SKU"), warehouseId: "WH", warehouseName: "Main", quantity: 2 }, maxAgeMs: 120_000 } as const;
    const missing = await assessAmisStock({ ...base, requested: { ...base.requested, sku: parseRawSku("MISSING") }, now: "2026-07-22T00:00:00.000Z" });
    const stale = await assessAmisStock({ ...base, now: "2026-07-22T00:00:00.000Z" });
    const insufficient = await assessAmisStock({ ...base, requested: { ...base.requested, quantity: 2 }, now: "2026-07-21T00:01:00.000Z" });
    expect(missing).toEqual({ kind: "unavailable", reason: "missing" });
    expect(stale).toEqual({ kind: "unavailable", reason: "stale" });
    expect(insufficient).toEqual({ kind: "unavailable", reason: "insufficient" });

    const malformed = await readAmisStockLedger({ fetchPage: pages([{ total_pages: 1, data: [{ product_code: "SKU" }] }]) });
    expect(malformed.kind).toBe("malformed");
  });

  it("returns deterministic availability and digest for an exact selected warehouse", async () => {
    const ledger = await readAmisStockLedger({ fetchPage: pages([{ total_pages: 1, data: [
      { product_code: "SKU", warehouse_id: "WH", warehouse_name: "Main", amount_summary: 2, observed_at: "2026-07-22T00:00:00.000Z" },
      { product_code: "SKU", warehouse_id: "OTHER", warehouse_name: "Main", amount_summary: 99, observed_at: "2026-07-22T00:00:00.000Z" },
    ] }]) });
    const input = { ledger, requested: { sku: parseRawSku("SKU"), warehouseId: "WH", warehouseName: "Main", quantity: 2 }, now: "2026-07-22T00:01:00.000Z", maxAgeMs: 120_000 } as const;
    const first = await assessAmisStock(input);
    const second = await assessAmisStock(input);
    expect(first).toEqual(second);
    expect(first.kind).toBe("available");
    if (first.kind !== "available") return;
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("AMIS capability", () => {
  it("denies by default without tenant proof", () => {
    const result = createAmisReadCapability({
      origin: "https://crmconnect.misa.vn",
      tenantProof: { readonly: true, tenantId: "tenant-test", stockReadProven: false },
    });
    expect(result.kind).toBe("denied");
  });

  it("allows only a proven stock read through the local capability adapter", () => {
    const result = createAmisReadCapability({ origin: "https://crmconnect.misa.vn", tenantProof: proof });
    expect(result.kind).toBe("allowed");
    if (result.kind !== "allowed") return;
    expect(result.capability.paths).toEqual(["/api/v2/Stocks/product_ledger"]);
    expect(result.capability.methods).toEqual(["GET"]);
  });
});
