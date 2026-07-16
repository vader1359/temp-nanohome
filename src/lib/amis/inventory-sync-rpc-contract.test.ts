import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("AMIS inventory RPC contract", () => {
  it("omits nullable optimistic-lock arguments so PostgreSQL defaults preserve null semantics", async () => {
    // Given: the server-only AMIS inventory synchronization boundary.
    const source = await readFile(resolve(process.cwd(), "src/lib/amis/inventory-sync.ts"), "utf8");

    // When: a baseline is created before an active baseline exists.
    const baselineFlow = source.match(/export async function runAmisInventoryBaseline\(\)[\s\S]*?\n}\n/)?.[0];

    // Then: the typed RPC call leaves nullable lock arguments to database defaults.
    expect(baselineFlow).toContain("p_expected_baseline_id: state?.active_baseline_id ?? undefined");
    expect(baselineFlow).not.toContain("p_watermark:");
    expect(baselineFlow).not.toContain("p_expected_watermark:");
  });
});
