import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("AMIS inventory sync RPC nullable params migration", () => {
  it("declares DEFAULT NULL for the three nullable params so the type generator emits them as optional", async () => {
    // Given: the nullable-params migration that re-declares apply_amis_inventory_sync.
    const migration = await readFile(
      resolve(process.cwd(), "supabase/migrations/20260726001100_amis_inventory_sync_nullable_params.sql"),
      "utf8",
    );

    // When: the function signature is inspected.
    const signature = migration.match(/create or replace function[\s\S]*?\(([^)]+)\)/)?.[1] ?? "";

    // Then: each of the three nullable parameters carries DEFAULT NULL so callers never need
    // to coerce null to string at the TypeScript layer.
    expect(signature).toMatch(/p_watermark[^,]*default null/i);
    expect(signature).toMatch(/p_expected_baseline_id[^,]*default null/i);
    expect(signature).toMatch(/p_expected_watermark[^,]*default null/i);

    // And: the required params (mode, completed_at, baseline_lines, orders, order_lines) are NOT defaulted.
    expect(signature).not.toMatch(/p_mode[^,]*default/i);
    expect(signature).not.toMatch(/p_completed_at[^,]*default/i);
  });

  it("emits optional fields in the generated database type for the nullable RPC params", async () => {
    // Given: the generated database types reflecting the nullable-params migration.
    const types = await readFile(resolve(process.cwd(), "src/types/database.types.ts"), "utf8");

    // When: the apply_amis_inventory_sync Args block is inspected.
    const argsBlock = types.match(/apply_amis_inventory_sync:\s*\{[\s\S]*?Args:\s*\{([^}]+)\}/)?.[1] ?? "";

    // Then: the three nullable params are optional (?: syntax) so TypeScript callers may omit them.
    expect(argsBlock).toMatch(/p_watermark\?:/);
    expect(argsBlock).toMatch(/p_expected_baseline_id\?:/);
    expect(argsBlock).toMatch(/p_expected_watermark\?:/);

    // And: the required params remain non-optional.
    expect(argsBlock).not.toMatch(/p_mode\?:/);
    expect(argsBlock).not.toMatch(/p_completed_at\?:/);
  });

  it("does not pass null for any RPC argument in inventory-sync.ts — only undefined via omission", async () => {
    // Given: the inventory sync source that calls supabase.rpc for both baseline and sale-order paths.
    const source = await readFile(resolve(process.cwd(), "src/lib/amis/inventory-sync.ts"), "utf8");

    // When: every RPC argument object in the source is inspected.
    // Then: no argument is explicitly set to null (null would produce a type error for optional params).
    // Only undefined (via omission or explicit undefined) is acceptable at the type boundary.
    const rpcCallSite = source.match(/applyInventorySync\(supabase,\s*\{([\s\S]*?)\}\)/g) ?? [];
    for (const call of rpcCallSite) {
      expect(call, "RPC args must not pass null — use undefined/omit for optional params").not.toMatch(/:\s*null\b/);
    }
  });
});

describe("AMIS inventory baseline RPC migration", () => {
  it("rejects a stale expected baseline before mutating the active snapshot", async () => {
    // Given: a baseline RPC replacement migration.
    const migration = await readFile(resolve(process.cwd(), "supabase/migrations/20260711000004_use_strict_amis_inventory_cutoff.sql"), "utf8");

    // When: the baseline branch receives a different current baseline than it observed before fetching.
    const baselineBranch = migration.match(/if p_mode = 'baseline' then([\s\S]*?)elsif p_mode = 'sale_orders'/)?.[1];

    // Then: it raises on the null-safe mismatch before inserting or deactivating a baseline.
    expect(baselineBranch).toMatch(/active_baseline_id[\s\S]*is distinct from p_expected_baseline_id[\s\S]*raise exception[\s\S]*insert into amis_inventory_baselines/);
  });

  it("selects the single UUID without an unsupported aggregate", async () => {
    // Given: the same migration's unique local SKU projection.
    const migration = await readFile(resolve(process.cwd(), "supabase/migrations/20260711000004_use_strict_amis_inventory_cutoff.sql"), "utf8");

    // When: exactly one local variant shares a SKU.
    const uniqueVariants = migration.match(/unique_variants as \(([\s\S]*?)\), updated as/)?.[1];

    // Then: PostgreSQL selects it through an ordered UUID array rather than min(uuid), which PostgreSQL does not implement.
    expect(uniqueVariants).toContain("(array_agg(id order by id))[1] as id");
    expect(uniqueVariants).not.toContain("min(id)");
  });

  it("reserves only sale orders approved after the completed baseline snapshot", async () => {
    // Given: the migration that computes available stock from the snapshot and sale orders.
    const migration = await readFile(resolve(process.cwd(), "supabase/migrations/20260711000004_use_strict_amis_inventory_cutoff.sql"), "utf8");

    // When: the availability reservation cutoff is inspected.
    const availableStock = migration.match(/with available as \(([\s\S]*?)\), unique_variants as/)?.[1];

    // Then: orders at the completed snapshot time are already represented in the ledger and are not reserved twice.
    expect(availableStock).toContain("sale_order.approved_date > active.completed_at");
    expect(availableStock).not.toContain("sale_order.approved_date >= active.completed_at");
  });
});
