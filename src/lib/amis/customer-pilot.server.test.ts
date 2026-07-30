import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  normalizeVietnamMobile,
  selectCustomerPilotCohort,
  type AmisPilotCustomerSource,
} from "@/lib/amis/customer-pilot.server";

const auditHmacKey = "fixture-only-pilot-audit-key-32-bytes-minimum";

describe("customer pilot cohort", () => {
  it.each([
    ["0901 234 567", "0901234567"],
    ["+84 901-234-567", "0901234567"],
    ["0084(901)234567", "0901234567"],
    ["84901234567", "0901234567"],
  ])("normalizes supported Vietnam mobile notation", (input, expected) => {
    expect(normalizeVietnamMobile(input)).toBe(expected);
  });

  it.each(["0123456789", "090123456", "+12025550123", "not-a-phone"])(
    "rejects invalid or non-Vietnam mobile values: %s",
    (input) => {
      expect(normalizeVietnamMobile(input)).toBeNull();
    },
  );

  it("selects exactly ten in stable ID order and emits only opaque evidence", () => {
    const customers = buildCustomers(12).reverse();

    const result = selectCustomerPilotCohort({
      customers,
      existingLinkedCustomerIds: new Set(),
      existingFirebasePhoneDigests: new Set(),
      auditHmacKey,
    });

    expect(result.kind).toBe("selected");
    if (result.kind !== "selected") return;
    expect(result.evidence).toMatchObject({ eligibleCount: 12, selectedCount: 10 });
    expect(result.selected.map((candidate) => candidate.customerId)).toEqual(
      Array.from({ length: 10 }, (_, index) => String(index + 1)),
    );
    expect(result.selected.map((candidate) => candidate.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.evidence.cohortDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result.evidence)).not.toMatch(/090|example\.test/i);
  });

  it("rejects ambiguous, inactive, linked, malformed, and existing identities without relaxing size", () => {
    const customers = buildCustomers(18);
    customers[0] = { ...customers[0]!, state: "merged" };
    customers[1] = { ...customers[1]!, phoneValues: ["invalid"] };
    customers[2] = { ...customers[2]!, emailValues: ["invalid"] };
    customers[3] = { ...customers[3]!, phoneValues: [customers[4]!.phoneValues[0]!] };
    customers[5] = { ...customers[5]!, code: customers[6]!.code };
    customers[7] = { ...customers[7]!, phoneValues: [] };
    const existingPhone = normalizeVietnamMobile(customers[9]!.phoneValues[0]!)!;
    const existingPhoneDigest = createHmac("sha256", auditHmacKey)
      .update(`phone\u0000${existingPhone}`)
      .digest("hex");

    const result = selectCustomerPilotCohort({
      customers,
      existingLinkedCustomerIds: new Set([customers[10]!.id]),
      existingFirebasePhoneDigests: new Set([existingPhoneDigest]),
      auditHmacKey,
    });

    expect(result).toMatchObject({
      kind: "blocked",
      reason: "insufficient_eligible_candidates",
      evidence: {
        selectedCount: 0,
        conflictCounts: {
          duplicate_customer_code: 2,
          existing_firebase_phone: 1,
          existing_link: 1,
          identity_conflict: 2,
          invalid_email: 1,
          invalid_phone: 1,
          phone_count_not_one: 1,
          source_state_not_active: 1,
        },
      },
    });
  });

  it("rejects a short audit key before processing PII", () => {
    expect(() => selectCustomerPilotCohort({
      customers: [],
      existingLinkedCustomerIds: new Set(),
      existingFirebasePhoneDigests: new Set(),
      auditHmacKey: "short",
    })).toThrow(/32 bytes/);
  });
});

function buildCustomers(count: number): AmisPilotCustomerSource[] {
  return Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    const suffix = String(1_000_000 + ordinal).slice(-7);
    return {
      id: String(ordinal),
      code: `C${String(ordinal).padStart(3, "0")}`,
      state: "active",
      phoneValues: [`090${suffix}`],
      emailValues: [],
    };
  });
}
