import "server-only";

import { createHmac } from "node:crypto";

import { z } from "zod";

export type PilotSourceState = "active" | "inactive" | "merged" | "unknown";

export type AmisPilotCustomerSource = Readonly<{
  id: string;
  code: string;
  state: PilotSourceState;
  phoneValues: readonly string[];
  emailValues: readonly string[];
}>;

export type AmisPilotContactSource = Readonly<{
  id: string;
  customerCode: string | null;
  state: PilotSourceState;
  phoneValues: readonly string[];
  emailValues: readonly string[];
}>;

export type SelectedPilotCustomer = Readonly<{
  ordinal: number;
  customerId: string;
  contactId: string | null;
  phoneE164: string;
  phoneDigest: string;
  emailDigest: string | null;
  sourceDigest: string;
}>;

export type PilotRejectionCode =
  | "duplicate_customer_code"
  | "existing_firebase_phone"
  | "existing_link"
  | "identity_conflict"
  | "invalid_email"
  | "invalid_phone"
  | "missing_customer_code"
  | "multiple_valid_contacts"
  | "phone_count_not_one"
  | "source_state_not_active";

export type PilotCohortEvidence = Readonly<{
  eligibleCount: number;
  selectedCount: number;
  cohortDigest: string | null;
  conflictCounts: Readonly<Record<PilotRejectionCode, number>>;
  orphanContactCount: number;
}>;

export type PilotCohortResult =
  | Readonly<{
    kind: "selected";
    evidence: PilotCohortEvidence;
    selected: readonly SelectedPilotCustomer[];
  }>
  | Readonly<{
    kind: "blocked";
    reason: "insufficient_eligible_candidates";
    evidence: PilotCohortEvidence;
  }>;

type PreparedCandidate = Readonly<{
  customerId: string;
  customerCode: string;
  contactId: string | null;
  phoneLocal: string;
  phoneE164: string;
  phoneDigest: string;
  emailDigest: string | null;
  sourceDigest: string;
}>;

const vietnamMobileSchema = z.string().regex(/^0(?:3|5|7|8|9)\d{8}$/);
const emailSchema = z.string().email();

export function selectCustomerPilotCohort(input: Readonly<{
  customers: readonly AmisPilotCustomerSource[];
  contacts: readonly AmisPilotContactSource[];
  existingLinkedCustomerIds: ReadonlySet<string>;
  existingFirebasePhoneDigests: ReadonlySet<string>;
  auditHmacKey: string;
  size?: number;
}>): PilotCohortResult {
  assertAuditKey(input.auditHmacKey);
  const size = input.size ?? 10;
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new TypeError("Pilot cohort size must be a positive safe integer");
  }

  const conflictCounts = emptyConflictCounts();
  const customersByCode = indexCustomersByCode(input.customers);
  const duplicateCodes = new Set(
    [...customersByCode.entries()]
      .filter(([, customers]) => customers.length !== 1)
      .map(([code]) => code),
  );
  const contactsByCustomerCode = indexContactsByCustomerCode(input.contacts);
  const orphanContactCount = input.contacts.filter((contact) =>
    contact.customerCode === null || !customersByCode.has(contact.customerCode.trim())).length;

  const prepared: PreparedCandidate[] = [];
  for (const customer of input.customers) {
    const customerCode = customer.code.trim();
    if (customerCode.length === 0) {
      conflictCounts.missing_customer_code += 1;
      continue;
    }
    if (duplicateCodes.has(customerCode)) {
      conflictCounts.duplicate_customer_code += 1;
      continue;
    }
    if (customer.state !== "active") {
      conflictCounts.source_state_not_active += 1;
      continue;
    }
    if (input.existingLinkedCustomerIds.has(customer.id)) {
      conflictCounts.existing_link += 1;
      continue;
    }

    const contacts = contactsByCustomerCode.get(customerCode) ?? [];
    if (contacts.some((contact) => contact.state !== "active")) {
      conflictCounts.source_state_not_active += 1;
      continue;
    }

    const normalizedCustomerPhones = normalizePhoneValues(customer.phoneValues);
    const normalizedContactPhones = contacts.map((contact) => ({
      contact,
      phones: normalizePhoneValues(contact.phoneValues),
    }));
    if (!normalizedCustomerPhones.valid || normalizedContactPhones.some((entry) => !entry.phones.valid)) {
      conflictCounts.invalid_phone += 1;
      continue;
    }
    const contactsWithPhone = normalizedContactPhones.filter((entry) => entry.phones.values.length > 0);
    if (contactsWithPhone.length > 1) {
      conflictCounts.multiple_valid_contacts += 1;
      continue;
    }
    const phones = new Set([
      ...normalizedCustomerPhones.values,
      ...normalizedContactPhones.flatMap((entry) => entry.phones.values),
    ]);
    if (phones.size !== 1) {
      conflictCounts.phone_count_not_one += 1;
      continue;
    }

    const normalizedCustomerEmails = normalizeEmailValues(customer.emailValues);
    const normalizedContactEmails = contacts.map((contact) => normalizeEmailValues(contact.emailValues));
    if (!normalizedCustomerEmails.valid || normalizedContactEmails.some((entry) => !entry.valid)) {
      conflictCounts.invalid_email += 1;
      continue;
    }
    const emails = new Set([
      ...normalizedCustomerEmails.values,
      ...normalizedContactEmails.flatMap((entry) => entry.values),
    ]);
    if (emails.size > 1) {
      conflictCounts.identity_conflict += 1;
      continue;
    }

    const phoneLocal = [...phones][0];
    if (phoneLocal === undefined) {
      conflictCounts.phone_count_not_one += 1;
      continue;
    }
    const phoneE164 = `+84${phoneLocal.slice(1)}`;
    const phoneDigest = hmac(input.auditHmacKey, `phone\u0000${phoneLocal}`);
    if (input.existingFirebasePhoneDigests.has(phoneDigest)) {
      conflictCounts.existing_firebase_phone += 1;
      continue;
    }
    const email = [...emails][0] ?? null;
    const emailDigest = email === null ? null : hmac(input.auditHmacKey, `email\u0000${email}`);
    const contactId = contactsWithPhone[0]?.contact.id ?? null;
    const sourceDigest = hmac(
      input.auditHmacKey,
      ["source", customer.id, customerCode, contactId ?? "", phoneDigest, emailDigest ?? ""].join("\u0000"),
    );
    prepared.push({
      customerId: customer.id,
      customerCode,
      contactId,
      phoneLocal,
      phoneE164,
      phoneDigest,
      emailDigest,
      sourceDigest,
    });
  }

  const identityConflicts = findIdentityConflicts(prepared);
  const eligible = prepared.filter((candidate) => {
    if (!identityConflicts.has(candidate.customerId)) return true;
    conflictCounts.identity_conflict += 1;
    return false;
  }).sort(comparePreparedCandidates);

  if (eligible.length < size) {
    return {
      kind: "blocked",
      reason: "insufficient_eligible_candidates",
      evidence: {
        eligibleCount: eligible.length,
        selectedCount: 0,
        cohortDigest: null,
        conflictCounts,
        orphanContactCount,
      },
    };
  }

  const selected = eligible.slice(0, size).map((candidate, index): SelectedPilotCustomer => ({
    ordinal: index + 1,
    customerId: candidate.customerId,
    contactId: candidate.contactId,
    phoneE164: candidate.phoneE164,
    phoneDigest: candidate.phoneDigest,
    emailDigest: candidate.emailDigest,
    sourceDigest: candidate.sourceDigest,
  }));
  const cohortDigest = hmac(
    input.auditHmacKey,
    selected.map((candidate) =>
      [candidate.ordinal, candidate.customerId, candidate.contactId ?? "", candidate.phoneDigest, candidate.sourceDigest].join("\u0000"))
      .join("\u0001"),
  );

  return {
    kind: "selected",
    selected,
    evidence: {
      eligibleCount: eligible.length,
      selectedCount: selected.length,
      cohortDigest,
      conflictCounts,
      orphanContactCount,
    },
  };
}

export function normalizeVietnamMobile(value: string): string | null {
  const compact = value.trim().replaceAll(/[\s().-]/g, "");
  let local = compact;
  if (local.startsWith("+84")) local = `0${local.slice(3)}`;
  else if (local.startsWith("0084")) local = `0${local.slice(4)}`;
  else if (local.startsWith("84")) local = `0${local.slice(2)}`;
  if (!vietnamMobileSchema.safeParse(local).success) return null;
  return local;
}

function normalizePhoneValues(values: readonly string[]): Readonly<{ valid: boolean; values: readonly string[] }> {
  const normalized = new Set<string>();
  for (const raw of values) {
    if (raw.trim().length === 0) continue;
    const phone = normalizeVietnamMobile(raw);
    if (phone === null) return { valid: false, values: [] };
    normalized.add(phone);
  }
  return { valid: true, values: [...normalized].sort() };
}

function normalizeEmailValues(values: readonly string[]): Readonly<{ valid: boolean; values: readonly string[] }> {
  const normalized = new Set<string>();
  for (const raw of values) {
    if (raw.trim().length === 0) continue;
    const email = raw.trim().toLowerCase();
    if (!emailSchema.safeParse(email).success) return { valid: false, values: [] };
    normalized.add(email);
  }
  return { valid: true, values: [...normalized].sort() };
}

function indexCustomersByCode(
  customers: readonly AmisPilotCustomerSource[],
): ReadonlyMap<string, readonly AmisPilotCustomerSource[]> {
  const result = new Map<string, AmisPilotCustomerSource[]>();
  for (const customer of customers) {
    const code = customer.code.trim();
    const bucket = result.get(code) ?? [];
    bucket.push(customer);
    result.set(code, bucket);
  }
  return result;
}

function indexContactsByCustomerCode(
  contacts: readonly AmisPilotContactSource[],
): ReadonlyMap<string, readonly AmisPilotContactSource[]> {
  const result = new Map<string, AmisPilotContactSource[]>();
  for (const contact of contacts) {
    if (contact.customerCode === null) continue;
    const code = contact.customerCode.trim();
    if (code.length === 0) continue;
    const bucket = result.get(code) ?? [];
    bucket.push(contact);
    result.set(code, bucket);
  }
  return result;
}

function findIdentityConflicts(candidates: readonly PreparedCandidate[]): ReadonlySet<string> {
  const conflicts = new Set<string>();
  const phoneOwners = new Map<string, Set<string>>();
  const emailOwners = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    addOwner(phoneOwners, candidate.phoneDigest, candidate.customerId);
    if (candidate.emailDigest !== null) addOwner(emailOwners, candidate.emailDigest, candidate.customerId);
  }
  for (const owners of [...phoneOwners.values(), ...emailOwners.values()]) {
    if (owners.size > 1) {
      for (const owner of owners) conflicts.add(owner);
    }
  }
  return conflicts;
}

function addOwner(index: Map<string, Set<string>>, identity: string, customerId: string): void {
  const owners = index.get(identity) ?? new Set<string>();
  owners.add(customerId);
  index.set(identity, owners);
}

function comparePreparedCandidates(left: PreparedCandidate, right: PreparedCandidate): number {
  const idComparison = left.customerId.localeCompare(right.customerId, "en", { numeric: true });
  if (idComparison !== 0) return idComparison;
  return left.customerCode.localeCompare(right.customerCode, "en", { numeric: true });
}

function emptyConflictCounts(): Record<PilotRejectionCode, number> {
  return {
    duplicate_customer_code: 0,
    existing_firebase_phone: 0,
    existing_link: 0,
    identity_conflict: 0,
    invalid_email: 0,
    invalid_phone: 0,
    missing_customer_code: 0,
    multiple_valid_contacts: 0,
    phone_count_not_one: 0,
    source_state_not_active: 0,
  };
}

function assertAuditKey(key: string): void {
  if (Buffer.byteLength(key, "utf8") < 32) {
    throw new TypeError("Pilot audit HMAC key must contain at least 32 bytes");
  }
}

function hmac(key: string, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}
