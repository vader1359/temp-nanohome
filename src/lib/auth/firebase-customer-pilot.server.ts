import "server-only";

import { createHmac } from "node:crypto";

import type { SelectedPilotCustomer } from "@/lib/amis/customer-pilot.server";

export const FIREBASE_CUSTOMER_PILOT_PROJECT = "temp-nanohome";
export const FIREBASE_CUSTOMER_PILOT_VERSION = "ai-commerce-staging-pilot-v1";

export type FirebasePilotCapabilityProof = Readonly<{
  projectId: string;
  disabledPhoneCreateProven: boolean;
  duplicatePhoneLookupProven: boolean;
  rollbackDeleteProven: boolean;
  createSendsNotification: boolean;
  verifiedOtpClaimBridgeProven: boolean;
}>;

export type FirebasePilotCapability =
  | Readonly<{ kind: "allowed"; projectId: typeof FIREBASE_CUSTOMER_PILOT_PROJECT }>
  | Readonly<{
    kind: "blocked";
    reason:
      | "disabled_phone_create_unproven"
      | "duplicate_phone_lookup_unproven"
      | "notification_risk"
      | "otp_claim_bridge_missing"
      | "rollback_delete_unproven"
      | "sandbox_project_mismatch";
  }>;

export type FirebasePilotUser = Readonly<{
  uid: string;
  phoneNumber: string | null;
  disabled: boolean;
  hasPassword: boolean;
  roleClaim: string | null;
}>;

export type FirebasePilotAdminPort = Readonly<{
  getUserByPhoneNumber: (phoneNumber: string) => Promise<FirebasePilotUser | null>;
  getUser: (uid: string) => Promise<FirebasePilotUser | null>;
  createUser: (request: Readonly<{
    uid: string;
    phoneNumber: string;
    disabled: true;
  }>) => Promise<FirebasePilotUser>;
  deleteUser: (uid: string) => Promise<void>;
}>;

export type FirebasePilotMapping = Readonly<{
  pilotVersion: typeof FIREBASE_CUSTOMER_PILOT_VERSION;
  environment: typeof FIREBASE_CUSTOMER_PILOT_PROJECT;
  ordinal: number;
  customerId: string;
  contactId: string | null;
  firebaseUid: string;
  phoneDigest: string;
  sourceDigest: string;
  state: "provisioned_disabled";
}>;

export type FirebasePilotRollbackReceipt = Readonly<{
  pilotVersion: typeof FIREBASE_CUSTOMER_PILOT_VERSION;
  environment: typeof FIREBASE_CUSTOMER_PILOT_PROJECT;
  rollbackDigest: string;
  rolledBackCount: number;
  deletedCount: number;
  alreadyAbsentCount: number;
}>;

export function assessFirebasePilotCapability(proof: FirebasePilotCapabilityProof): FirebasePilotCapability {
  if (proof.projectId !== FIREBASE_CUSTOMER_PILOT_PROJECT) {
    return { kind: "blocked", reason: "sandbox_project_mismatch" };
  }
  if (!proof.disabledPhoneCreateProven) {
    return { kind: "blocked", reason: "disabled_phone_create_unproven" };
  }
  if (!proof.duplicatePhoneLookupProven) {
    return { kind: "blocked", reason: "duplicate_phone_lookup_unproven" };
  }
  if (proof.createSendsNotification) {
    return { kind: "blocked", reason: "notification_risk" };
  }
  if (!proof.rollbackDeleteProven) {
    return { kind: "blocked", reason: "rollback_delete_unproven" };
  }
  if (!proof.verifiedOtpClaimBridgeProven) {
    return { kind: "blocked", reason: "otp_claim_bridge_missing" };
  }
  return { kind: "allowed", projectId: FIREBASE_CUSTOMER_PILOT_PROJECT };
}

export async function preprovisionDisabledFirebasePilot(input: Readonly<{
  capability: FirebasePilotCapability;
  selected: readonly SelectedPilotCustomer[];
  admin: FirebasePilotAdminPort;
  auditHmacKey: string;
}>): Promise<readonly FirebasePilotMapping[]> {
  assertAllowedCapability(input.capability);
  assertPilotSize(input.selected);
  assertAuditKey(input.auditHmacKey);

  const mappings: FirebasePilotMapping[] = [];
  for (const candidate of input.selected) {
    const expectedUid = deterministicPilotUid(candidate.sourceDigest, input.auditHmacKey);
    const existing = await input.admin.getUserByPhoneNumber(candidate.phoneE164);
    let user = existing;
    if (user === null) {
      user = await input.admin.createUser({
        uid: expectedUid,
        phoneNumber: candidate.phoneE164,
        disabled: true,
      });
    }
    if (!isExpectedDisabledPilotUser(user, expectedUid, candidate.phoneE164)) {
      if (existing === null && user.uid === expectedUid) {
        await input.admin.deleteUser(expectedUid);
      }
      throw new Error("Firebase pilot identity conflict");
    }
    mappings.push({
      pilotVersion: FIREBASE_CUSTOMER_PILOT_VERSION,
      environment: FIREBASE_CUSTOMER_PILOT_PROJECT,
      ordinal: candidate.ordinal,
      customerId: candidate.customerId,
      contactId: candidate.contactId,
      firebaseUid: expectedUid,
      phoneDigest: candidate.phoneDigest,
      sourceDigest: candidate.sourceDigest,
      state: "provisioned_disabled",
    });
  }
  return mappings;
}

export async function rollbackDisabledFirebasePilot(input: Readonly<{
  capability: FirebasePilotCapability;
  mappings: readonly FirebasePilotMapping[];
  admin: FirebasePilotAdminPort;
  auditHmacKey: string;
}>): Promise<FirebasePilotRollbackReceipt> {
  assertAllowedCapability(input.capability);
  assertMappingSize(input.mappings);
  assertAuditKey(input.auditHmacKey);

  let deletedCount = 0;
  let alreadyAbsentCount = 0;
  for (const mapping of input.mappings) {
    const expectedUid = deterministicPilotUid(mapping.sourceDigest, input.auditHmacKey);
    if (
      mapping.environment !== FIREBASE_CUSTOMER_PILOT_PROJECT
      || mapping.pilotVersion !== FIREBASE_CUSTOMER_PILOT_VERSION
      || mapping.state !== "provisioned_disabled"
      || mapping.firebaseUid !== expectedUid
    ) {
      throw new Error("Firebase pilot rollback marker mismatch");
    }
    const user = await input.admin.getUser(expectedUid);
    if (user === null) {
      alreadyAbsentCount += 1;
      continue;
    }
    if (user.uid !== expectedUid || !user.disabled || user.hasPassword || user.roleClaim !== null) {
      throw new Error("Firebase pilot rollback identity mismatch");
    }
    await input.admin.deleteUser(expectedUid);
    deletedCount += 1;
  }

  const rollbackDigest = hmac(
    input.auditHmacKey,
    input.mappings
      .map((mapping) => [mapping.ordinal, mapping.firebaseUid, mapping.sourceDigest].join("\u0000"))
      .join("\u0001"),
  );
  return {
    pilotVersion: FIREBASE_CUSTOMER_PILOT_VERSION,
    environment: FIREBASE_CUSTOMER_PILOT_PROJECT,
    rollbackDigest,
    rolledBackCount: input.mappings.length,
    deletedCount,
    alreadyAbsentCount,
  };
}

function deterministicPilotUid(sourceDigest: string, auditHmacKey: string): string {
  return `nh-pilot-${hmac(auditHmacKey, `uid\u0000${sourceDigest}`).slice(0, 40)}`;
}

function isExpectedDisabledPilotUser(user: FirebasePilotUser, expectedUid: string, phoneNumber: string): boolean {
  return user.uid === expectedUid
    && user.phoneNumber === phoneNumber
    && user.disabled
    && !user.hasPassword
    && user.roleClaim === null;
}

function assertAllowedCapability(
  capability: FirebasePilotCapability,
): asserts capability is Extract<FirebasePilotCapability, { kind: "allowed" }> {
  if (capability.kind !== "allowed") {
    throw new Error(`Firebase pilot capability blocked: ${capability.reason}`);
  }
}

function assertPilotSize(selected: readonly SelectedPilotCustomer[]): void {
  if (selected.length !== 10 || selected.some((candidate, index) => candidate.ordinal !== index + 1)) {
    throw new Error("Firebase pilot requires exactly ten ordered candidates");
  }
}

function assertMappingSize(mappings: readonly FirebasePilotMapping[]): void {
  if (mappings.length !== 10 || mappings.some((mapping, index) => mapping.ordinal !== index + 1)) {
    throw new Error("Firebase pilot rollback requires exactly ten ordered mappings");
  }
}

function assertAuditKey(key: string): void {
  if (Buffer.byteLength(key, "utf8") < 32) {
    throw new TypeError("Pilot audit HMAC key must contain at least 32 bytes");
  }
}

function hmac(key: string, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}
