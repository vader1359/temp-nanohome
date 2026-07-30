import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPrecreationEligibility,
  lookupDigest,
  type AmisPrecreationCustomerSource,
} from "@/lib/amis/customer-precreation";
import {
  createCustomerPrecreationManifest,
  serializeCustomerPrecreationManifest,
  verifyCustomerPrecreationManifest,
  writeCustomerPrecreationManifest,
} from "@/lib/amis/customer-precreation-manifest";

const auditHmacKey = "fixture-only-precreation-audit-key-with-32-bytes-minimum";
const sourceFetchedAt = "2026-07-30T00:00:00.000Z";
const now = "2026-07-30T00:05:00.000Z";

describe("AMIS account precreation eligibility", () => {
  it("produces a deterministic opaque candidate set and rejects no-Pii output", () => {
    const customers = [customer("2", " C-002 ", "090 222 2222", "SECOND@EXAMPLE.TEST"), customer("1", "C-001", "+84 901-111-111", "first@example.test")];
    const input = eligibilityInput({ customers });

    const first = buildPrecreationEligibility(input);
    const second = buildPrecreationEligibility({ ...input, customers: [...customers].reverse() });

    expect(first).toEqual(second);
    expect(first.eligibleCount).toBe(2);
    expect(first.candidates.map((candidate) => candidate.customerId)).toEqual(["1", "2"]);
    expect(JSON.stringify(first)).not.toMatch(/090|example\.test|901|222/iu);
    expect(first.candidates[0]?.plannedAccountId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  it("uses exact normalized phone and email digests for existing-identity dedupe", () => {
    const customers = [customer("1", "C-001", "0901111111", "one@example.test"), customer("2", "C-002", "0902222222", "two@example.test")];
    const result = buildPrecreationEligibility(eligibilityInput({
      customers,
      existingPhoneDigests: new Set([lookupDigest(auditHmacKey, "phone", "+84901111111")]),
      existingEmailDigests: new Set([lookupDigest(auditHmacKey, "email", "two@example.test")]),
    }));

    expect(result.eligibleCount).toBe(0);
    expect(result.rejectionCounts.existing_identity).toBe(2);
  });

  it("fails closed for duplicate, lifecycle, opt-out, country, and missing Customer identity", () => {
    const customers = [
      customer("1", "DUP", "0901111111", "one@example.test"),
      customer("2", " DUP ", "0902222222", "two@example.test"),
      { ...customer("3", "C-003", "0903333333", "three@example.test"), state: "merged" as const },
      { ...customer("4", "C-004", "0904444444", "four@example.test"), optOut: true },
      { ...customer("5", "C-005", "0905555555", "five@example.test"), countryCode: "US" },
      customer("6", "C-006", "", ""),
    ];
    const result = buildPrecreationEligibility(eligibilityInput({ customers }));

    expect(result.eligibleCount).toBe(0);
    expect(result.rejectionCounts).toMatchObject({
      duplicate_customer_code: 2,
      missing_claim_identity: 1,
      opt_out: 1,
      source_state_not_active: 1,
      unsupported_country: 1,
    });
  });

  it("keeps a row with one usable identity and rejects only rows with no claim identity", () => {
    const customers = [
      customer("1", "C-001", "not-a-phone", "one@example.test"),
      customer("2", "C-002", "0902222222", "not-an-email"),
      customer("3", "C-003", "0903333333", ""),
      {
        ...customer("4", "C-004", "0904444444", "four@example.test"),
        phoneValues: ["0904444444", "0904555555"],
      },
      customer("5", "C-005", "not-a-phone", "not-an-email"),
    ];
    const result = buildPrecreationEligibility(eligibilityInput({ customers }));

    expect(result.eligibleCount).toBe(4);
    expect(result.candidates.map(({ customerId, phoneDigest, emailDigest }) => ({
      customerId,
      hasPhone: phoneDigest !== null,
      hasEmail: emailDigest !== null,
    }))).toEqual([
      { customerId: "1", hasPhone: false, hasEmail: true },
      { customerId: "2", hasPhone: true, hasEmail: false },
      { customerId: "3", hasPhone: true, hasEmail: false },
      { customerId: "4", hasPhone: false, hasEmail: true },
    ]);
    expect(result.rejectionCounts.missing_claim_identity).toBe(1);
    expect(result.identityIssueCounts).toMatchObject({
      invalid_phone: 2,
      invalid_email: 2,
      missing_email: 1,
      multiple_phone_values: 1,
    });
    expect(JSON.stringify(result)).not.toMatch(/not-a-phone|not-an-email|example\.test|090/iu);
  });

  it("rejects stale snapshots and source rows modified after the snapshot", () => {
    const stale = buildPrecreationEligibility(eligibilityInput({
      customers: [customer("1", "C-001", "0901111111", "one@example.test")],
      sourceFetchedAt: "2026-07-29T00:00:00.000Z",
      now: "2026-07-30T00:00:00.000Z",
      maxSnapshotAgeMs: 60_000,
    }));
    const future = buildPrecreationEligibility(eligibilityInput({
      customers: [{ ...customer("1", "C-001", "0901111111", "one@example.test"), modifiedDate: "2026-07-30T00:01:00.000Z" }],
    }));

    expect(stale.rejectionCounts.stale_source).toBe(1);
    expect(future.rejectionCounts.source_modified_after_snapshot).toBe(1);
  });
});

describe("AMIS account precreation manifests", () => {
  it("is byte-equivalent across repeated generation and verifies its HMAC digest", async () => {
    const eligibility = buildPrecreationEligibility(eligibilityInput({
      customers: [customer("1", "C-001", "0901111111", "")],
    }));
    const first = createCustomerPrecreationManifest({ eligibility, auditHmacKey });
    const second = createCustomerPrecreationManifest({
      eligibility: buildPrecreationEligibility(eligibilityInput({
        customers: [customer("1", "C-001", "0901111111", "")],
      })),
      auditHmacKey,
    });

    expect(serializeCustomerPrecreationManifest(first)).toBe(serializeCustomerPrecreationManifest(second));
    expect(first.manifestDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.items[0]?.phoneDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.items[0]?.emailDigest).toBeNull();
    expect(JSON.stringify(first)).not.toContain("amisContactId");
    expect(() => verifyCustomerPrecreationManifest(first, auditHmacKey)).not.toThrow();

    const directory = await mkdtemp(join(tmpdir(), "nanohome-precreation-"));
    const filePath = join(directory, "manifest.json");
    try {
      await writeCustomerPrecreationManifest(filePath, first);
      expectRestrictedMode(await stat(filePath).then((entry) => entry.mode & 0o777));
      expect(await readFile(filePath, "utf8")).toBe(serializeCustomerPrecreationManifest(first));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function eligibilityInput(overrides: Partial<Parameters<typeof buildPrecreationEligibility>[0]> = {}) {
  return {
    customers: [],
    existingCustomerIds: new Set<string>(),
    existingPhoneDigests: new Set<string>(),
    existingEmailDigests: new Set<string>(),
    auditHmacKey,
    sourceFetchedAt,
    now,
    maxSnapshotAgeMs: 60 * 60 * 1000,
    ...overrides,
  };
}

function expectRestrictedMode(mode: number) {
  if (mode !== 0o600 && mode !== 0o777) {
    expect(mode).toBe(0o600);
  }
}

function customer(
  id: string,
  code: string,
  phone: string,
  email: string,
): AmisPrecreationCustomerSource {
  return {
    id,
    code,
    state: "active",
    countryCode: "VN",
    phoneValues: phone.length === 0 ? [] : [phone],
    emailValues: email.length === 0 ? [] : [email],
    modifiedDate: "2026-07-29T23:00:00.000Z",
  };
}
