import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("AMIS inventory baseline RPC migration", () => {
  it("rejects a stale expected baseline before mutating the active snapshot", async () => {
    // Given: a baseline RPC replacement migration.
    const migration = await readFile(resolve(process.cwd(), "supabase/migrations/20260710000007_use_strict_amis_inventory_cutoff.sql"), "utf8");

    // When: the baseline branch receives a different current baseline than it observed before fetching.
    const baselineBranch = migration.match(/if p_mode = 'baseline' then([\s\S]*?)elsif p_mode = 'sale_orders'/)?.[1];

    // Then: it raises on the null-safe mismatch before inserting or deactivating a baseline.
    expect(baselineBranch).toMatch(/active_baseline_id[\s\S]*is distinct from p_expected_baseline_id[\s\S]*raise exception[\s\S]*insert into amis_inventory_baselines/);
  });

  it("selects the single UUID without an unsupported aggregate", async () => {
    // Given: the same migration's unique local SKU projection.
    const migration = await readFile(resolve(process.cwd(), "supabase/migrations/20260710000007_use_strict_amis_inventory_cutoff.sql"), "utf8");

    // When: exactly one local variant shares a SKU.
    const uniqueVariants = migration.match(/unique_variants as \(([\s\S]*?)\), updated as/)?.[1];

    // Then: PostgreSQL selects it through an ordered UUID array rather than min(uuid), which PostgreSQL does not implement.
    expect(uniqueVariants).toContain("(array_agg(id order by id))[1] as id");
    expect(uniqueVariants).not.toContain("min(id)");
  });

  it("reserves only sale orders approved after the completed baseline snapshot", async () => {
    // Given: the migration that computes available stock from the snapshot and sale orders.
    const migration = await readFile(resolve(process.cwd(), "supabase/migrations/20260710000007_use_strict_amis_inventory_cutoff.sql"), "utf8");

    // When: the availability reservation cutoff is inspected.
    const availableStock = migration.match(/with available as \(([\s\S]*?)\), unique_variants as/)?.[1];

    // Then: orders at the completed snapshot time are already represented in the ledger and are not reserved twice.
    expect(availableStock).toContain("sale_order.approved_date > active.completed_at");
    expect(availableStock).not.toContain("sale_order.approved_date >= active.completed_at");
  });
});
