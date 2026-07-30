import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { createHmac } from "node:crypto";

import {
  CUSTOMER_PRECREATION_MANIFEST_VERSION,
  type PrecreationCandidate,
  type PrecreationEligibilityResult,
  type PrecreationIdentityIssueCounts,
  type PrecreationRejectionCounts,
} from "@/lib/amis/customer-precreation";

export type PrecreationManifestItem = Readonly<{
  readonly ordinal: number;
  readonly amisCustomerId: string;
  readonly sourceDigest: string;
  readonly phoneDigest: string | null;
  readonly emailDigest: string | null;
  readonly sourceModifiedAt: string;
  readonly plannedAccountId: string;
}>;

export type CustomerPrecreationManifest = Readonly<{
  readonly version: typeof CUSTOMER_PRECREATION_MANIFEST_VERSION;
  readonly sourceWatermark: string;
  readonly candidateCount: number;
  readonly eligibleCount: number;
  readonly rejectionCounts: PrecreationRejectionCounts;
  readonly identityIssueCounts: PrecreationIdentityIssueCounts;
  readonly manifestDigest: string;
  readonly items: readonly PrecreationManifestItem[];
}>;

export function createCustomerPrecreationManifest(input: Readonly<{
  readonly eligibility: PrecreationEligibilityResult;
  readonly auditHmacKey: string;
}>): CustomerPrecreationManifest {
  assertAuditKey(input.auditHmacKey);
  const sourceWatermark = input.eligibility.sourceWatermark;
  if (sourceWatermark === null) throw new Error("A source watermark is required for a manifest");
  const unsigned = {
    version: CUSTOMER_PRECREATION_MANIFEST_VERSION,
    sourceWatermark,
    candidateCount: input.eligibility.candidateCount,
    eligibleCount: input.eligibility.eligibleCount,
    rejectionCounts: stableRejectionCounts(input.eligibility.rejectionCounts),
    identityIssueCounts: stableIdentityIssueCounts(input.eligibility.identityIssueCounts),
    items: input.eligibility.candidates.map(toManifestItem),
  } as const;
  return {
    ...unsigned,
    manifestDigest: hmac(input.auditHmacKey, JSON.stringify(unsigned)),
  };
}

export function verifyCustomerPrecreationManifest(
  manifest: CustomerPrecreationManifest,
  auditHmacKey: string,
): void {
  assertAuditKey(auditHmacKey);
  if (manifest.version !== CUSTOMER_PRECREATION_MANIFEST_VERSION) {
    throw new Error("Unsupported customer precreation manifest version");
  }
  if (manifest.items.length !== manifest.eligibleCount) {
    throw new Error("Manifest eligible count does not match item count");
  }
  manifest.items.forEach((item, index) => {
    if (item.ordinal !== index + 1) throw new Error("Manifest ordinals must be contiguous");
    if (item.phoneDigest === null && item.emailDigest === null) {
      throw new Error("Manifest items require at least one claim identity digest");
    }
    if ((item.phoneDigest !== null && !isLookupDigest(item.phoneDigest))
      || (item.emailDigest !== null && !isLookupDigest(item.emailDigest))) {
      throw new Error("Manifest identity digest is malformed");
    }
  });
  const unsigned = Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== "manifestDigest"),
  );
  const expected = hmac(auditHmacKey, JSON.stringify({
    ...unsigned,
    rejectionCounts: stableRejectionCounts(manifest.rejectionCounts),
    identityIssueCounts: stableIdentityIssueCounts(manifest.identityIssueCounts),
  }));
  if (expected !== manifest.manifestDigest) throw new Error("Manifest digest mismatch");
}

export function serializeCustomerPrecreationManifest(manifest: CustomerPrecreationManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function writeCustomerPrecreationManifest(
  filePath: string,
  manifest: CustomerPrecreationManifest,
): Promise<void> {
  if (!isAbsolute(filePath)) throw new TypeError("Manifest path must be absolute");
  const serialized = serializeCustomerPrecreationManifest(manifest);
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, serialized, { encoding: "utf8", mode: 0o600 });
  await chmod(filePath, 0o600);
}

function toManifestItem(candidate: PrecreationCandidate, index: number): PrecreationManifestItem {
  return {
    ordinal: index + 1,
    amisCustomerId: candidate.customerId,
    sourceDigest: candidate.sourceDigest,
    phoneDigest: candidate.phoneDigest,
    emailDigest: candidate.emailDigest,
    sourceModifiedAt: candidate.sourceModifiedAt,
    plannedAccountId: candidate.plannedAccountId,
  };
}

function stableRejectionCounts(counts: PrecreationRejectionCounts): PrecreationRejectionCounts {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  ) as PrecreationRejectionCounts;
}

function stableIdentityIssueCounts(counts: PrecreationIdentityIssueCounts): PrecreationIdentityIssueCounts {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  ) as PrecreationIdentityIssueCounts;
}

function isLookupDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function assertAuditKey(key: string): void {
  if (Buffer.byteLength(key, "utf8") < 32) {
    throw new TypeError("Customer precreation HMAC key must contain at least 32 bytes");
  }
}

function hmac(key: string, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}
