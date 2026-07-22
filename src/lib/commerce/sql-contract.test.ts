import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("commerce ledger SQL contracts", () => {
  it("scopes checkout idempotency and payload hashes to an owner", () => {
    const sql = readFileSync("supabase/migrations/20260721030000_add_commerce_checkout_ledger.sql", "utf8");

    expect(sql).toMatch(/owner_scope text[^,]*not null/);
    expect(sql).toMatch(/payload_hash text[^,]*not null/);
    expect(sql).toMatch(/commerce_checkouts_owner_idempotency_key[\s\S]*on public\.commerce_checkouts \(owner_scope collate "C", idempotency_key collate "C"\)/);
  });

  it("uniquely identifies a refund request per checkout and request digest", () => {
    const sql = readFileSync("supabase/migrations/20260721030000_add_commerce_checkout_ledger.sql", "utf8");

    expect(sql).toMatch(/commerce_refund_ledger_request_identity[\s\S]*unique \(checkout_id, request_digest\)/);
  });
});
