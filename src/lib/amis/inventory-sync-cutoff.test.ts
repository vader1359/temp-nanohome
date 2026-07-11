import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("runAmisInventoryBaseline", () => {
  it("captures its baseline cutoff after reading the complete AMIS ledger", async () => {
    // Given: the baseline sync implementation source.
    const source = await readFile(resolve(process.cwd(), "src/lib/amis/inventory-sync.ts"), "utf8");

    // When: the physical baseline flow is inspected.
    const baselineFlow = source.match(/export async function runAmisInventoryBaseline\(\)[\s\S]*?\n}\n/)?.[0];

    // Then: the successful full ledger read completes before its cutoff feeds the RPC argument.
    expect(baselineFlow).toMatch(/fetchAmisStockLedger\(config\)[\s\S]*ledger\.kind !== "success"[\s\S]*const completedAt = new Date\(\)\.toISOString\(\);[\s\S]*p_completed_at: completedAt/);
  });
});
