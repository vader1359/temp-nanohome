import { describe, expect, it, vi } from "vitest";

import { buildPrecreationEligibility } from "@/lib/amis/customer-precreation";
import { createCustomerPrecreationManifest } from "@/lib/amis/customer-precreation-manifest";
import {
  claimPrecreatedCustomer,
  createCustomerPrecreationRepository,
  executeCustomerPrecreationBatch,
  getCustomerAccountIdentityAssurance,
  type CustomerPrecreationRepository,
} from "@/lib/amis/customer-precreation.server";

const auditHmacKey = "fixture-only-precreation-server-key-with-32-bytes-minimum";

describe("customer precreation server contract", () => {
  it("requires the exact owner-approved manifest and fails production closed", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const repository = createCustomerPrecreationRepository({
      baseUrl: "http://127.0.0.1:54321",
      projectRef: "local-project",
      serviceRoleKey: "fixture-service-role",
      fetcher,
      writeGate: {
        environment: "production",
        batchWritesEnabled: true,
        claimWritesEnabled: false,
        assuranceReadsEnabled: false,
        approvedBy: "owner-fixture",
        approvedManifestDigest: "not-the-manifest",
      },
    });

    const manifest = buildManifest();
    await expect(repository.beginBatch({
      environment: "production",
      manifest,
      approvedBy: "owner-fixture",
    })).rejects.toMatchObject({ code: "manifest_mismatch" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("binds repository execution to the configured environment and approver", async () => {
    const manifest = buildManifest();
    const fetcher = vi.fn<typeof fetch>();
    const repository = createCustomerPrecreationRepository({
      baseUrl: "http://127.0.0.1:54321",
      projectRef: "local-project",
      serviceRoleKey: "fixture-service-role",
      fetcher,
      writeGate: {
        environment: "staging",
        batchWritesEnabled: true,
        claimWritesEnabled: false,
        assuranceReadsEnabled: false,
        approvedBy: "owner-fixture",
        approvedManifestDigest: manifest.manifestDigest,
      },
    });

    await expect(repository.beginBatch({
      environment: "local",
      manifest,
      approvedBy: "owner-fixture",
    })).rejects.toMatchObject({ code: "invalid_environment" });
    await expect(repository.beginBatch({
      environment: "staging",
      manifest,
      approvedBy: "other-fixture",
    })).rejects.toMatchObject({ code: "owner_gate_required" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never calls the repository for a malformed verified factor", async () => {
    const claim = vi.fn();
    const repository = { claim } as unknown as CustomerPrecreationRepository;

    const result = await claimPrecreatedCustomer({
      auditHmacKey,
      repository,
      claim: {
        firebaseUid: "firebase-fixture",
        verifiedPhoneE164: "not-a-phone",
        phoneVerified: true,
        emailVerified: false,
      },
    });

    expect(result).toEqual({ status: "not_claimable", accountId: null, assurance: null });
    expect(claim).not.toHaveBeenCalled();
  });

  it("claims with one verified factor and marks checkout assurance ready", async () => {
    const claim = vi.fn(async () => ({
      status: "claimed" as const,
      accountId: "00000000-0000-4000-8000-000000000401",
      assurance: {
        registrationClaimed: true,
        phoneVerified: true,
        emailVerified: false,
        checkoutReady: true,
      },
    }));
    const repository = { claim } as unknown as CustomerPrecreationRepository;

    const result = await claimPrecreatedCustomer({
      auditHmacKey,
      repository,
      claim: {
        firebaseUid: "firebase-fixture",
        verifiedPhoneE164: "0901111111",
        phoneVerified: true,
        emailVerified: false,
      },
    });

    expect(result.assurance).toEqual({
      registrationClaimed: true,
      phoneVerified: true,
      emailVerified: false,
      checkoutReady: true,
    });
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({
      phoneDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      emailDigest: null,
    }));
  });

  it("passes only keyed exact identities to co-auth claim storage", async () => {
    const claim = vi.fn(async () => ({
      status: "claimed" as const,
      accountId: "00000000-0000-4000-8000-000000000401",
      assurance: {
        registrationClaimed: true,
        phoneVerified: true,
        emailVerified: true,
        checkoutReady: true,
      },
    }));
    const repository = { claim } as unknown as CustomerPrecreationRepository;

    const result = await claimPrecreatedCustomer({
      auditHmacKey,
      repository,
      claim: {
        firebaseUid: "firebase-fixture",
        verifiedPhoneE164: "0901111111",
        verifiedEmail: "USER@EXAMPLE.TEST",
        phoneVerified: true,
        emailVerified: true,
        policyAcceptances: [{ kind: "terms", version: "2026-07" }],
      },
    });

    expect(result.status).toBe("claimed");
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({
      firebaseUid: "firebase-fixture",
      phoneDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      emailDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
    expect(JSON.stringify(claim.mock.calls[0])).not.toMatch(/0901111111|user@example\.test/iu);
  });

  it("reads checkout assurance behind a read-only gate independent of claim writes", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([{
      account_id: "00000000-0000-4000-8000-000000000401",
      registration_claimed: true,
      phone_verified: true,
      email_verified: false,
      checkout_ready: true,
    }]), { headers: { "content-type": "application/json" }, status: 200 }));
    const repository = createCustomerPrecreationRepository({
      baseUrl: "http://127.0.0.1:54321",
      projectRef: "local-project",
      serviceRoleKey: "fixture-service-role",
      fetcher,
      writeGate: {
        environment: "staging",
        batchWritesEnabled: false,
        claimWritesEnabled: false,
        assuranceReadsEnabled: true,
      },
    });

    const result = await getCustomerAccountIdentityAssurance({
      firebaseUid: "firebase-fixture",
      repository,
    });

    expect(result).toEqual({
      accountId: "00000000-0000-4000-8000-000000000401",
      assurance: {
        registrationClaimed: true,
        phoneVerified: true,
        emailVerified: false,
        checkoutReady: true,
      },
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("/rest/v1/rpc/customer_account_identity_assurance");
    await expect(repository.claim({
      firebaseUid: "firebase-fixture",
      phoneDigest: "a".repeat(64),
      emailDigest: null,
      policyAcceptances: [],
    })).rejects.toMatchObject({ code: "write_disabled" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("executes items in manifest order and reconciles the exact manifest", async () => {
    const manifest = buildManifest();
    const itemResults: string[] = [];
    const repository: CustomerPrecreationRepository = {
      beginBatch: vi.fn(async () => ({ batchId: "batch-fixture", status: "running" })),
      precreateItem: vi.fn(async ({ item }) => {
        itemResults.push(item.amisCustomerId);
        return { resultCode: "created" as const, accountId: item.plannedAccountId };
      }),
      claim: vi.fn(),
      getAssurance: vi.fn(),
      reconcile: vi.fn(async () => ({
        batchStatus: "reconciled" as const,
        expectedCount: 1,
        processedCount: 1,
        createdCount: 1,
        skippedCount: 0,
        conflictCount: 0,
        failedCount: 0,
        driftCount: 0,
      })),
      rollback: vi.fn(),
    };

    const result = await executeCustomerPrecreationBatch({
      auditHmacKey,
      approvedBy: "owner-fixture",
      environment: "staging",
      manifest,
      repository,
    });

    expect(itemResults).toEqual(["customer-fixture"]);
    expect(result.reconciliation.driftCount).toBe(0);
    expect(result.itemResults).toEqual([{ ordinal: 1, resultCode: "created" }]);
  });
});

function buildManifest() {
  const eligibility = buildPrecreationEligibility({
    customers: [{
      id: "customer-fixture",
      code: "C-FIXTURE",
      state: "active",
      countryCode: "VN",
      phoneValues: ["0901111111"],
      emailValues: ["user@example.test"],
      modifiedDate: "2026-07-29T23:00:00.000Z",
    }],
    existingCustomerIds: new Set(),
    existingPhoneDigests: new Set(),
    existingEmailDigests: new Set(),
    auditHmacKey,
    sourceFetchedAt: "2026-07-30T00:00:00.000Z",
    now: "2026-07-30T00:05:00.000Z",
    maxSnapshotAgeMs: 60 * 60 * 1000,
  });
  return createCustomerPrecreationManifest({ eligibility, auditHmacKey });
}
