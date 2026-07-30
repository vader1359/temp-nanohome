import { createHmac } from "node:crypto";

import { normalizeVietnamPhone } from "@/lib/auth/phone";

export const CUSTOMER_PRECREATION_MANIFEST_VERSION = "amis-account-precreate-v3" as const;

export type PrecreationSourceState = "active" | "inactive" | "deleted" | "merged" | "unknown";

export type AmisPrecreationCustomerSource = Readonly<{
  readonly id: string;
  readonly code: string;
  readonly state: PrecreationSourceState;
  readonly countryCode?: string | null;
  readonly phoneValues: readonly string[];
  readonly emailValues: readonly string[];
  readonly optOut?: boolean;
  readonly modifiedDate: string;
}>;

export type PrecreationRejectionCode =
  | "duplicate_customer_code"
  | "existing_customer_account"
  | "existing_identity"
  | "identity_conflict"
  | "missing_claim_identity"
  | "missing_customer_code"
  | "opt_out"
  | "source_modified_after_snapshot"
  | "source_state_not_active"
  | "stale_source"
  | "unsupported_country";

export type PrecreationRejectionCounts = Readonly<Record<PrecreationRejectionCode, number>>;

export type PrecreationIdentityIssueCode =
  | "invalid_email"
  | "invalid_phone"
  | "missing_email"
  | "missing_phone"
  | "multiple_email_values"
  | "multiple_phone_values";

export type PrecreationIdentityIssueCounts = Readonly<Record<PrecreationIdentityIssueCode, number>>;

export type PrecreationCandidate = Readonly<{
  readonly customerId: string;
  readonly customerCode: string;
  readonly phoneDigest: string | null;
  readonly emailDigest: string | null;
  readonly sourceDigest: string;
  readonly sourceModifiedAt: string;
  readonly plannedAccountId: string;
}>;

export type PrecreationEligibilityResult = Readonly<{
  readonly sourceWatermark: string | null;
  readonly candidateCount: number;
  readonly eligibleCount: number;
  readonly candidates: readonly PrecreationCandidate[];
  readonly rejectionCounts: PrecreationRejectionCounts;
  readonly identityIssueCounts: PrecreationIdentityIssueCounts;
}>;

export type BuildPrecreationEligibilityInput = Readonly<{
  readonly customers: readonly AmisPrecreationCustomerSource[];
  readonly existingCustomerIds: ReadonlySet<string>;
  readonly existingPhoneDigests: ReadonlySet<string>;
  readonly existingEmailDigests: ReadonlySet<string>;
  readonly auditHmacKey: string;
  readonly sourceFetchedAt: string;
  readonly now: string;
  readonly maxSnapshotAgeMs: number;
  readonly sourceWatermark?: string | null;
  readonly supportedCountries?: readonly string[];
}>;

type NormalizedValues = Readonly<{ valid: boolean; values: readonly string[] }>;
type PreparedCandidate = PrecreationCandidate;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function buildPrecreationEligibility(
  input: BuildPrecreationEligibilityInput,
): PrecreationEligibilityResult {
  assertAuditKey(input.auditHmacKey);
  assertIsoDate(input.sourceFetchedAt, "sourceFetchedAt");
  assertIsoDate(input.now, "now");
  if (!Number.isSafeInteger(input.maxSnapshotAgeMs) || input.maxSnapshotAgeMs < 0) {
    throw new TypeError("maxSnapshotAgeMs must be a non-negative safe integer");
  }

  const rejectionCounts = emptyRejectionCounts();
  const identityIssueCounts = emptyIdentityIssueCounts();
  const customerCodes = indexCustomersByCode(input.customers);
  const duplicateCodes = new Set(
    [...customerCodes.entries()]
      .filter(([, records]) => records.length !== 1)
      .map(([code]) => code),
  );

  const supportedCountries = new Set(
    (input.supportedCountries ?? ["VN"]).map((country) => country.trim().toUpperCase()),
  );
  const snapshotAgeMs = Date.parse(input.now) - Date.parse(input.sourceFetchedAt);
  const sourceIsStale = !Number.isFinite(snapshotAgeMs) || snapshotAgeMs > input.maxSnapshotAgeMs;
  const prepared: PreparedCandidate[] = [];

  for (const customer of input.customers) {
    const code = customer.code.trim();
    if (code.length === 0) {
      rejectionCounts.missing_customer_code += 1;
      continue;
    }
    if (duplicateCodes.has(code)) {
      rejectionCounts.duplicate_customer_code += 1;
      continue;
    }
    if (sourceIsStale) {
      rejectionCounts.stale_source += 1;
      continue;
    }
    if (Date.parse(customer.modifiedDate) > Date.parse(input.sourceFetchedAt)) {
      rejectionCounts.source_modified_after_snapshot += 1;
      continue;
    }
    if (customer.state !== "active") {
      rejectionCounts.source_state_not_active += 1;
      continue;
    }
    if (customer.optOut === true) {
      rejectionCounts.opt_out += 1;
      continue;
    }
    if (input.existingCustomerIds.has(customer.id)) {
      rejectionCounts.existing_customer_account += 1;
      continue;
    }

    const customerCountry = normalizeCountry(customer.countryCode);
    if (!supportedCountries.has(customerCountry ?? "VN")) {
      rejectionCounts.unsupported_country += 1;
      continue;
    }

    const phones = normalizePhoneValues(customer.phoneValues);
    const phoneE164 = selectSingleIdentity(
      phones,
      {
        invalid: "invalid_phone",
        missing: "missing_phone",
        multiple: "multiple_phone_values",
      },
      identityIssueCounts,
    );

    const emails = normalizeEmailValues(customer.emailValues);
    const email = selectSingleIdentity(
      emails,
      {
        invalid: "invalid_email",
        missing: "missing_email",
        multiple: "multiple_email_values",
      },
      identityIssueCounts,
    );
    if (phoneE164 === null && email === null) {
      rejectionCounts.missing_claim_identity += 1;
      continue;
    }
    const phoneDigest = phoneE164 === null ? null : lookupDigest(input.auditHmacKey, "phone", phoneE164);
    const emailDigest = email === null ? null : lookupDigest(input.auditHmacKey, "email", email);
    if ((phoneDigest !== null && input.existingPhoneDigests.has(phoneDigest))
      || (emailDigest !== null && input.existingEmailDigests.has(emailDigest))) {
      rejectionCounts.existing_identity += 1;
      continue;
    }

    const sourceModifiedAt = customer.modifiedDate;
    const sourceDigest = hmac(input.auditHmacKey, [
      "source",
      customer.id,
      code,
      phoneDigest ?? "",
      emailDigest ?? "",
      sourceModifiedAt,
    ].join("\u0000"));
    prepared.push({
      customerId: customer.id,
      customerCode: code,
      phoneDigest,
      emailDigest,
      sourceDigest,
      sourceModifiedAt,
      plannedAccountId: deterministicUuid(input.auditHmacKey, `account\u0000${customer.id}`),
    });
  }

  const identityConflicts = findIdentityConflicts(prepared);
  const candidates = prepared
    .filter((candidate) => {
      if (!identityConflicts.has(candidate.customerId)) return true;
      rejectionCounts.identity_conflict += 1;
      return false;
    })
    .sort(compareCandidates);

  return {
    sourceWatermark: input.sourceWatermark ?? maxSourceWatermark(input.customers),
    candidateCount: input.customers.length,
    eligibleCount: candidates.length,
    candidates,
    rejectionCounts,
    identityIssueCounts,
  };
}

export function lookupDigest(auditHmacKey: string, kind: "phone" | "email", value: string): string {
  assertAuditKey(auditHmacKey);
  return hmac(auditHmacKey, `${kind}\u0000${value}`);
}

export function normalizeClaimEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function normalizePhoneValues(values: readonly string[]): NormalizedValues {
  const normalized = new Set<string>();
  for (const raw of values) {
    if (raw.trim().length === 0) continue;
    const phone = normalizeVietnamPhone(raw);
    if (phone === null) return { valid: false, values: [] };
    normalized.add(phone);
  }
  return { valid: true, values: [...normalized].sort() };
}

function normalizeEmailValues(values: readonly string[]): NormalizedValues {
  const normalized = new Set<string>();
  for (const raw of values) {
    if (raw.trim().length === 0) continue;
    const email = normalizeClaimEmail(raw);
    if (email === null) return { valid: false, values: [] };
    normalized.add(email);
  }
  return { valid: true, values: [...normalized].sort() };
}

function selectSingleIdentity(
  normalized: NormalizedValues,
  codes: Readonly<{
    readonly invalid: PrecreationIdentityIssueCode;
    readonly missing: PrecreationIdentityIssueCode;
    readonly multiple: PrecreationIdentityIssueCode;
  }>,
  issueCounts: { -readonly [Key in PrecreationIdentityIssueCode]: number },
): string | null {
  if (!normalized.valid) {
    issueCounts[codes.invalid] += 1;
    return null;
  }
  if (normalized.values.length === 0) {
    issueCounts[codes.missing] += 1;
    return null;
  }
  if (normalized.values.length !== 1) {
    issueCounts[codes.multiple] += 1;
    return null;
  }
  return normalized.values[0] ?? null;
}

function indexCustomersByCode(
  customers: readonly AmisPrecreationCustomerSource[],
): ReadonlyMap<string, readonly AmisPrecreationCustomerSource[]> {
  const result = new Map<string, AmisPrecreationCustomerSource[]>();
  for (const customer of customers) {
    const code = customer.code.trim();
    const bucket = result.get(code) ?? [];
    bucket.push(customer);
    result.set(code, bucket);
  }
  return result;
}

function findIdentityConflicts(candidates: readonly PreparedCandidate[]): ReadonlySet<string> {
  const ownersByIdentity = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    addIdentityOwner(ownersByIdentity, candidate.phoneDigest, candidate.customerId);
    addIdentityOwner(ownersByIdentity, candidate.emailDigest, candidate.customerId);
  }
  const conflicts = new Set<string>();
  for (const owners of ownersByIdentity.values()) {
    if (owners.size > 1) {
      for (const owner of owners) conflicts.add(owner);
    }
  }
  return conflicts;
}

function addIdentityOwner(index: Map<string, Set<string>>, identity: string | null, customerId: string): void {
  if (identity === null) return;
  const owners = index.get(identity) ?? new Set<string>();
  owners.add(customerId);
  index.set(identity, owners);
}

function compareCandidates(left: PrecreationCandidate, right: PrecreationCandidate): number {
  const customerComparison = left.customerId.localeCompare(right.customerId, "en", { numeric: true });
  if (customerComparison !== 0) return customerComparison;
  return left.customerCode.localeCompare(right.customerCode, "en", { numeric: true });
}

function emptyRejectionCounts(): Record<PrecreationRejectionCode, number> {
  return {
    duplicate_customer_code: 0,
    existing_customer_account: 0,
    existing_identity: 0,
    identity_conflict: 0,
    missing_claim_identity: 0,
    missing_customer_code: 0,
    opt_out: 0,
    source_modified_after_snapshot: 0,
    source_state_not_active: 0,
    stale_source: 0,
    unsupported_country: 0,
  };
}

function emptyIdentityIssueCounts(): Record<PrecreationIdentityIssueCode, number> {
  return {
    invalid_email: 0,
    invalid_phone: 0,
    missing_email: 0,
    missing_phone: 0,
    multiple_email_values: 0,
    multiple_phone_values: 0,
  };
}

function normalizeCountry(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized.length === 0 ? null : normalized;
}

function maxSourceWatermark(
  customers: readonly AmisPrecreationCustomerSource[],
): string | null {
  const dates = customers.map((customer) => customer.modifiedDate)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left));
  return dates[0] ?? null;
}

function deterministicUuid(key: string, value: string): string {
  const hex = hmac(key, value).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const raw = hex.join("");
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function assertAuditKey(key: string): void {
  if (Buffer.byteLength(key, "utf8") < 32) {
    throw new TypeError("Customer precreation HMAC key must contain at least 32 bytes");
  }
}

function assertIsoDate(value: string, name: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${name} must be an ISO date`);
}

function hmac(key: string, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}
