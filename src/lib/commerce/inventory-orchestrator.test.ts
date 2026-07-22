import { describe, expect, it } from "vitest";

import { parseRawSku, parseWarehouseId } from "./domain";
import { createInventoryHoldOrchestrator } from "./inventory-orchestrator";
import { createTestInventoryHoldRepository } from "./inventory-repository";
import type { InventoryClock } from "./inventory-repository";
import type { StockReadResult } from "./amis-reader";

const now = "2026-07-22T10:00:00.000Z";
const sku = parseRawSku("SKU-1");
const warehouseId = parseWarehouseId("WH-1");
const clock: InventoryClock = { now: () => now };

function successfulLedger(stock: number, observedAt = now): StockReadResult {
  return {
    kind: "success",
    ledger: { digest: "digest-1", records: [{ sku, warehouseId, warehouseName: "Main", stock, observedAt }] },
    records: [{ sku, warehouseId, warehouseName: "Main", stock, observedAt }],
  };
}

function duplicateLedger(): StockReadResult {
  const single = successfulLedger(3);
  if (single.kind !== "success") return single;
  const records = [...single.records, ...single.records];
  return { kind: "success", ledger: { digest: "digest-1", records }, records };
}

describe("inventory hold orchestration", () => {
  it("creates a ten-minute DB-owned hold from a fresh exact assessment", async () => {
    // Given: AMIS has one fresh exact observation and the durable port has capacity.
    const repository = createTestInventoryHoldRepository();
    const orchestrator = createInventoryHoldOrchestrator({ repository, clock });

    // When: the website asks to hold two units.
    const result = await orchestrator.create({ holdId: "hold-1", ledger: successfulLedger(3), sku, warehouseId, quantity: 2 });

    // Then: the hold is created for exactly ten minutes and one active hold is counted.
    expect(result).toEqual({ kind: "created", hold: { holdId: "hold-1", sku, warehouseId, quantity: 2, expiresAt: "2026-07-22T10:10:00.000Z" } });
    expect(await repository.activeQuantity({ sku, warehouseId, now })).toBe(2);
  });

  it("fails closed for malformed, stale, missing, duplicate, and insufficient observations", async () => {
    // Given: each AMIS observation is unsafe for a different reason.
    const repository = createTestInventoryHoldRepository();
    const orchestrator = createInventoryHoldOrchestrator({ repository, clock });
    const cases = [
      ["malformed", { kind: "malformed", message: "bad" } satisfies StockReadResult, "missing"],
      ["stale", successfulLedger(3, "2026-07-22T09:00:00.000Z"), "stale"],
      ["missing", successfulLedger(3), "missing"],
      ["duplicate", successfulLedger(3), "duplicate"],
      ["insufficient", successfulLedger(1), "insufficient"],
    ] as const;
    const ledgers: readonly StockReadResult[] = [
      cases[0][1],
      cases[1][1],
      { kind: "success", ledger: { digest: "digest-1", records: [] }, records: [] },
      duplicateLedger(),
      cases[4][1],
    ];

    // When: each unsafe observation is offered to the hold boundary.
    const results = await Promise.all(ledgers.map((ledger, index) => orchestrator.create({ holdId: `hold-${index}`, ledger, sku, warehouseId, quantity: 2 })));

    // Then: no unsafe observation creates a hold.
    expect(results.map((result) => result.kind === "rejected" ? result.reason : result.kind)).toEqual(["missing", "stale", "missing", "duplicate", "insufficient"]);
    expect(await repository.activeQuantity({ sku, warehouseId, now })).toBe(0);
  });

  it("makes repeated release and expiry idempotent", async () => {
    // Given: a created hold.
    const repository = createTestInventoryHoldRepository();
    let currentTime = now;
    const advancingClock: InventoryClock = { now: () => currentTime };
    const orchestrator = createInventoryHoldOrchestrator({ repository, clock: advancingClock });
    await orchestrator.create({ holdId: "hold-1", ledger: successfulLedger(3), sku, warehouseId, quantity: 2 });

    // When: expiry runs after the hold's ten-minute lifetime and then repeats.
    currentTime = "2026-07-22T10:10:00.000Z";
    const expiryOne = await orchestrator.expire("hold-1");
    const expiryTwo = await orchestrator.expire("hold-1");

    // Then: the first transition succeeds and the repeated transition is harmless.
    expect(expiryOne).toEqual({ kind: "expired" });
    expect(expiryTwo).toEqual({ kind: "already_inactive" });
    expect(await repository.activeQuantity({ sku, warehouseId, now: currentTime })).toBe(0);

    const release = await orchestrator.release("hold-1");
    expect(release).toEqual({ kind: "already_inactive" });
  });
});
