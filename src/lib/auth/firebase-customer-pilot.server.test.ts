import { describe, expect, it, vi } from "vitest";

import type { SelectedPilotCustomer } from "@/lib/amis/customer-pilot.server";
import {
  assessFirebasePilotCapability,
  preprovisionDisabledFirebasePilot,
  rollbackDisabledFirebasePilot,
  type FirebasePilotAdminPort,
  type FirebasePilotUser,
} from "@/lib/auth/firebase-customer-pilot.server";

const auditHmacKey = "fixture-only-pilot-audit-key-32-bytes-minimum";
const allowedCapability = assessFirebasePilotCapability({
  projectId: "temp-nanohome",
  disabledPhoneCreateProven: true,
  duplicatePhoneLookupProven: true,
  rollbackDeleteProven: true,
  createSendsNotification: false,
  verifiedOtpClaimBridgeProven: true,
});

describe("Firebase customer pilot capability", () => {
  it.each([
    [{ projectId: "production", disabledPhoneCreateProven: true, duplicatePhoneLookupProven: true, rollbackDeleteProven: true, createSendsNotification: false, verifiedOtpClaimBridgeProven: true }, "sandbox_project_mismatch"],
    [{ projectId: "temp-nanohome", disabledPhoneCreateProven: false, duplicatePhoneLookupProven: true, rollbackDeleteProven: true, createSendsNotification: false, verifiedOtpClaimBridgeProven: true }, "disabled_phone_create_unproven"],
    [{ projectId: "temp-nanohome", disabledPhoneCreateProven: true, duplicatePhoneLookupProven: true, rollbackDeleteProven: true, createSendsNotification: true, verifiedOtpClaimBridgeProven: true }, "notification_risk"],
    [{ projectId: "temp-nanohome", disabledPhoneCreateProven: true, duplicatePhoneLookupProven: true, rollbackDeleteProven: true, createSendsNotification: false, verifiedOtpClaimBridgeProven: false }, "otp_claim_bridge_missing"],
  ] as const)("fails closed for missing proof: %s", (proof, reason) => {
    expect(assessFirebasePilotCapability(proof)).toEqual({ kind: "blocked", reason });
  });

  it("creates exactly ten disabled phone-only users without password, role, or notification surface", async () => {
    const fake = createFakeAdmin();
    const selected = buildSelected();

    const mappings = await preprovisionDisabledFirebasePilot({
      capability: allowedCapability,
      selected,
      admin: fake.admin,
      auditHmacKey,
    });

    expect(mappings).toHaveLength(10);
    expect(fake.createUser).toHaveBeenCalledTimes(10);
    for (const [index, call] of fake.createUser.mock.calls.entries()) {
      expect(Object.keys(call[0]).sort()).toEqual(["disabled", "phoneNumber", "uid"]);
      expect(call[0]).toMatchObject({ disabled: true, phoneNumber: selected[index]!.phoneE164 });
      expect(call[0]).not.toHaveProperty("password");
      expect(call[0]).not.toHaveProperty("email");
      expect(call[0]).not.toHaveProperty("customClaims");
    }
    expect(JSON.stringify(mappings)).not.toMatch(/\+84|example\.test/i);
  });

  it("is idempotent for the same deterministic disabled identities", async () => {
    const fake = createFakeAdmin();
    const selected = buildSelected();
    const first = await preprovisionDisabledFirebasePilot({
      capability: allowedCapability,
      selected,
      admin: fake.admin,
      auditHmacKey,
    });
    const second = await preprovisionDisabledFirebasePilot({
      capability: allowedCapability,
      selected,
      admin: fake.admin,
      auditHmacKey,
    });

    expect(second).toEqual(first);
    expect(fake.createUser).toHaveBeenCalledTimes(10);
  });

  it("rejects an existing conflicting phone identity without exposing it in the error", async () => {
    const fake = createFakeAdmin();
    fake.usersByPhone.set(buildSelected()[0]!.phoneE164, {
      uid: "unrelated-user",
      phoneNumber: buildSelected()[0]!.phoneE164,
      disabled: false,
      hasPassword: false,
      roleClaim: null,
    });

    await expect(preprovisionDisabledFirebasePilot({
      capability: allowedCapability,
      selected: buildSelected(),
      admin: fake.admin,
      auditHmacKey,
    })).rejects.toThrow("Firebase pilot identity conflict");
    expect(fake.createUser).not.toHaveBeenCalled();
  });

  it("rolls back all ten deterministic pilot users and treats a replay as idempotent", async () => {
    const fake = createFakeAdmin();
    const mappings = await preprovisionDisabledFirebasePilot({
      capability: allowedCapability,
      selected: buildSelected(),
      admin: fake.admin,
      auditHmacKey,
    });

    const receipt = await rollbackDisabledFirebasePilot({
      capability: allowedCapability,
      mappings,
      admin: fake.admin,
      auditHmacKey,
    });
    const replay = await rollbackDisabledFirebasePilot({
      capability: allowedCapability,
      mappings,
      admin: fake.admin,
      auditHmacKey,
    });

    expect(receipt).toMatchObject({ rolledBackCount: 10, deletedCount: 10, alreadyAbsentCount: 0 });
    expect(replay).toMatchObject({ rolledBackCount: 10, deletedCount: 0, alreadyAbsentCount: 10 });
    expect(receipt.rollbackDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuses rollback when a mapping UID is not derived from its pilot marker", async () => {
    const fake = createFakeAdmin();
    const mappings = await preprovisionDisabledFirebasePilot({
      capability: allowedCapability,
      selected: buildSelected(),
      admin: fake.admin,
      auditHmacKey,
    });
    const tampered = mappings.map((mapping, index) =>
      index === 0 ? { ...mapping, firebaseUid: "existing-user" } : mapping);

    await expect(rollbackDisabledFirebasePilot({
      capability: allowedCapability,
      mappings: tampered,
      admin: fake.admin,
      auditHmacKey,
    })).rejects.toThrow("Firebase pilot rollback marker mismatch");
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });
});

function buildSelected(): SelectedPilotCustomer[] {
  return Array.from({ length: 10 }, (_, index) => ({
    ordinal: index + 1,
    customerId: String(index + 1),
    contactId: null,
    phoneE164: `+8490${String(1_000_001 + index).slice(-7)}`,
    phoneDigest: String(index + 1).padStart(64, "a"),
    emailDigest: null,
    sourceDigest: String(index + 1).padStart(64, "b"),
  }));
}

function createFakeAdmin(): {
  admin: FirebasePilotAdminPort;
  usersByPhone: Map<string, FirebasePilotUser>;
  createUser: ReturnType<typeof vi.fn<FirebasePilotAdminPort["createUser"]>>;
  deleteUser: ReturnType<typeof vi.fn<FirebasePilotAdminPort["deleteUser"]>>;
} {
  const usersByPhone = new Map<string, FirebasePilotUser>();
  const usersByUid = new Map<string, FirebasePilotUser>();
  const createUser = vi.fn<FirebasePilotAdminPort["createUser"]>(async (request) => {
    const user: FirebasePilotUser = {
      uid: request.uid,
      phoneNumber: request.phoneNumber,
      disabled: true,
      hasPassword: false,
      roleClaim: null,
    };
    usersByPhone.set(request.phoneNumber, user);
    usersByUid.set(request.uid, user);
    return user;
  });
  const deleteUser = vi.fn<FirebasePilotAdminPort["deleteUser"]>(async (uid) => {
    const user = usersByUid.get(uid);
    if (user?.phoneNumber !== null && user?.phoneNumber !== undefined) usersByPhone.delete(user.phoneNumber);
    usersByUid.delete(uid);
  });
  return {
    usersByPhone,
    createUser,
    deleteUser,
    admin: {
      getUserByPhoneNumber: async (phoneNumber) => usersByPhone.get(phoneNumber) ?? null,
      getUser: async (uid) => usersByUid.get(uid) ?? null,
      createUser,
      deleteUser,
    },
  };
}
