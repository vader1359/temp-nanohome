import "server-only";

import {
  CUSTOMER_PRECREATION_MANIFEST_VERSION,
  lookupDigest,
  normalizeClaimEmail,
} from "@/lib/amis/customer-precreation";
import {
  verifyCustomerPrecreationManifest,
  type CustomerPrecreationManifest,
} from "@/lib/amis/customer-precreation-manifest";
import { normalizeVietnamPhone } from "@/lib/auth/phone";

export type CustomerPrecreationEnvironment = "local" | "staging" | "production";

export type CustomerPrecreationAccessGate = Readonly<{
  readonly environment: CustomerPrecreationEnvironment;
  readonly batchWritesEnabled: boolean;
  readonly claimWritesEnabled: boolean;
  readonly assuranceReadsEnabled: boolean;
  readonly approvedBy?: string | null;
  readonly approvedManifestDigest?: string | null;
  readonly productionApproval?: boolean;
}>;

export type CustomerPrecreationWriteGate = CustomerPrecreationAccessGate;

type CustomerClaimBaseInput = Readonly<{
  readonly firebaseUid: string;
  readonly policyAcceptances?: readonly Readonly<{
    readonly kind: "terms" | "privacy" | "marketing";
    readonly version: string;
  }>[];
}>;

export type VerifiedCustomerClaimInput = CustomerClaimBaseInput & (
  | Readonly<{
    readonly verifiedPhoneE164: string;
    readonly verifiedEmail?: string;
    readonly phoneVerified: true;
    readonly emailVerified: false;
  }>
  | Readonly<{
    readonly verifiedPhoneE164?: string;
    readonly verifiedEmail: string;
    readonly phoneVerified: false;
    readonly emailVerified: true;
  }>
  | Readonly<{
    readonly verifiedPhoneE164: string;
    readonly verifiedEmail: string;
    readonly phoneVerified: true;
    readonly emailVerified: true;
  }>
);

export type CustomerIdentityAssurance = Readonly<{
  readonly registrationClaimed: boolean;
  readonly checkoutReady: boolean;
  readonly phoneVerified: boolean;
  readonly emailVerified: boolean;
}>;

export type CustomerClaimResult = Readonly<{
  readonly status: "claimed" | "already_claimed" | "not_claimable" | "conflict";
  readonly accountId: string | null;
  readonly assurance: CustomerIdentityAssurance | null;
}>;

export type CustomerIdentityAssuranceResult = Readonly<{
  readonly accountId: string | null;
  readonly assurance: CustomerIdentityAssurance | null;
}>;

export type CustomerPrecreationBatchItemResult = Readonly<{
  readonly ordinal: number;
  readonly resultCode: "created" | "skipped" | "conflict";
}>;

export type CustomerPrecreationReconciliation = Readonly<{
  readonly batchStatus: "reconciled" | "failed" | "rolled_back";
  readonly expectedCount: number;
  readonly processedCount: number;
  readonly createdCount: number;
  readonly skippedCount: number;
  readonly conflictCount: number;
  readonly failedCount: number;
  readonly driftCount: number;
}>;

export class CustomerPrecreationError extends Error {
  constructor(readonly code: "invalid_environment" | "write_disabled" | "read_disabled" | "owner_gate_required" | "manifest_mismatch" | "request_failed") {
    super(code);
    this.name = "CustomerPrecreationError";
  }
}

export type CustomerPrecreationRepository = Readonly<{
  readonly beginBatch: (input: Readonly<{
    readonly environment: CustomerPrecreationEnvironment;
    readonly manifest: CustomerPrecreationManifest;
    readonly approvedBy: string;
  }>) => Promise<Readonly<{ batchId: string; status: string }>>;
  readonly precreateItem: (input: Readonly<{
    readonly batchId: string;
    readonly manifestDigest: string;
    readonly item: CustomerPrecreationManifest["items"][number];
  }>) => Promise<Readonly<{ resultCode: "created" | "skipped" | "conflict"; accountId: string | null }>>;
  readonly claim: (input: Readonly<{
    readonly firebaseUid: string;
    readonly phoneDigest: string | null;
    readonly emailDigest: string | null;
    readonly policyAcceptances: readonly Readonly<{ readonly kind: string; readonly version: string }>[];
  }>) => Promise<CustomerClaimResult>;
  readonly getAssurance: (input: Readonly<{
    readonly firebaseUid: string;
  }>) => Promise<CustomerIdentityAssuranceResult>;
  readonly reconcile: (input: Readonly<{ readonly batchId: string; readonly manifestDigest: string }>) => Promise<CustomerPrecreationReconciliation>;
  readonly rollback: (input: Readonly<{ readonly batchId: string; readonly manifestDigest: string }>) => Promise<Readonly<{
    readonly batchStatus: "rolled_back";
    readonly rolledBackCount: number;
    readonly claimedPreservedCount: number;
  }>>;
}>;

export type CustomerPrecreationRepositoryOptions = Readonly<{
  readonly baseUrl: string;
  readonly projectRef: string;
  readonly serviceRoleKey: string;
  readonly writeGate: CustomerPrecreationAccessGate;
  readonly fetcher?: typeof fetch;
}>;

type RpcRow = Readonly<Record<string, unknown>>;

export function assertCustomerPrecreationBatchGate(
  gate: CustomerPrecreationWriteGate,
  manifestDigest: string,
): void {
  if (!gate.batchWritesEnabled) throw new CustomerPrecreationError("write_disabled");
  if (gate.approvedBy === undefined || gate.approvedBy === null || gate.approvedBy.trim().length === 0) {
    throw new CustomerPrecreationError("owner_gate_required");
  }
  if (gate.approvedManifestDigest !== manifestDigest) {
    throw new CustomerPrecreationError("manifest_mismatch");
  }
  if (gate.environment === "production" && gate.productionApproval !== true) {
    throw new CustomerPrecreationError("owner_gate_required");
  }
}

export function assertCustomerPrecreationClaimGate(gate: CustomerPrecreationWriteGate): void {
  if (!gate.claimWritesEnabled) throw new CustomerPrecreationError("write_disabled");
  if (gate.environment === "production" && gate.productionApproval !== true) {
    throw new CustomerPrecreationError("owner_gate_required");
  }
}

export function assertCustomerPrecreationAssuranceGate(gate: CustomerPrecreationAccessGate): void {
  if (!gate.assuranceReadsEnabled) throw new CustomerPrecreationError("read_disabled");
  if (gate.environment === "production" && gate.productionApproval !== true) {
    throw new CustomerPrecreationError("owner_gate_required");
  }
}

export function createCustomerPrecreationRepository(
  options: CustomerPrecreationRepositoryOptions,
): CustomerPrecreationRepository {
  if (options.serviceRoleKey.trim().length === 0) {
    throw new CustomerPrecreationError("invalid_environment");
  }
  const baseUrl = new URL(options.baseUrl);
  assertSafeSupabaseHost(baseUrl, options.projectRef);
  const fetcher = options.fetcher ?? fetch;

  async function requestRows<T>(
    resource: string,
    query: Readonly<Record<string, string>>,
    init: Readonly<{ readonly body?: unknown; readonly method?: string }> = {},
  ): Promise<readonly T[]> {
    const payload = await requestPayload(resource, query, init);
    if (!Array.isArray(payload)) throw new CustomerPrecreationError("request_failed");
    return payload as readonly T[];
  }

  async function requestPayload(
    resource: string,
    query: Readonly<Record<string, string>>,
    init: Readonly<{ readonly body?: unknown; readonly method?: string }> = {},
  ): Promise<unknown> {
    const method = (init.method ?? "GET").toUpperCase();
    const url = new URL(`/rest/v1/${resource}`, baseUrl);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    let response: Response;
    try {
      response = await fetcher(url, {
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${options.serviceRoleKey}`,
          apikey: options.serviceRoleKey,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        method,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new CustomerPrecreationError("request_failed");
    }
    if (!response.ok) throw new CustomerPrecreationError("request_failed");
    if (response.status === 204) return [];
    return response.json().catch(() => null);
  }

  async function requestRpc<T extends RpcRow>(name: string, body: Readonly<Record<string, unknown>>): Promise<readonly T[]> {
    return requestRows<T>(`rpc/${name}`, {}, { body, method: "POST" });
  }

  return {
    async beginBatch(input) {
      assertCustomerPrecreationBatchGate(options.writeGate, input.manifest.manifestDigest);
      if (input.environment !== options.writeGate.environment) {
        throw new CustomerPrecreationError("invalid_environment");
      }
      if (input.approvedBy.trim() !== options.writeGate.approvedBy?.trim()) {
        throw new CustomerPrecreationError("owner_gate_required");
      }
      const rows = await requestRpc<{ batch_id: string; batch_status: string }>("begin_customer_account_precreation_batch", {
        p_environment: input.environment,
        p_version: input.manifest.version,
        p_manifest_digest: input.manifest.manifestDigest,
        p_source_watermark: input.manifest.sourceWatermark,
        p_expected_count: input.manifest.eligibleCount,
        p_approved_by: input.approvedBy,
        p_approved_at: new Date().toISOString(),
      });
      const row = rows[0];
      if (row === undefined || typeof row.batch_id !== "string" || typeof row.batch_status !== "string") {
        throw new CustomerPrecreationError("request_failed");
      }
      return { batchId: row.batch_id, status: row.batch_status };
    },
    async precreateItem(input) {
      assertCustomerPrecreationBatchGate(options.writeGate, input.manifestDigest);
      const rows = await requestRpc<{ result_code: string; account_id: string | null }>("precreate_customer_account_item", {
        p_batch_id: input.batchId,
        p_manifest_digest: input.manifestDigest,
        p_ordinal: input.item.ordinal,
        p_amis_customer_id: input.item.amisCustomerId,
        p_source_digest: input.item.sourceDigest,
        p_phone_lookup_digest: input.item.phoneDigest,
        p_email_lookup_digest: input.item.emailDigest,
        p_source_modified_at: input.item.sourceModifiedAt,
        p_planned_account_id: input.item.plannedAccountId,
      });
      const row = rows[0];
      if (row === undefined || !isItemResultCode(row.result_code)) throw new CustomerPrecreationError("request_failed");
      return { resultCode: row.result_code, accountId: typeof row.account_id === "string" ? row.account_id : null };
    },
    async claim(input) {
      assertCustomerPrecreationClaimGate(options.writeGate);
      const rows = await requestRpc<{
        claim_status: string;
        account_id: string | null;
        phone_verified: boolean;
        email_verified: boolean;
        checkout_ready: boolean;
      }>("claim_customer_account_precreation", {
        p_firebase_uid: input.firebaseUid,
        p_phone_lookup_digest: input.phoneDigest,
        p_email_lookup_digest: input.emailDigest,
        p_phone_verified: input.phoneDigest !== null,
        p_email_verified: input.emailDigest !== null,
        p_policy_acceptances: input.policyAcceptances,
      });
      const row = rows[0];
      if (row === undefined || !isClaimStatus(row.claim_status)) throw new CustomerPrecreationError("request_failed");
      const accountId = isSafeUuid(row.account_id) ? row.account_id : null;
      const assurance = parseAssurance(row);
      if ((row.claim_status === "claimed" || row.claim_status === "already_claimed")
        && (accountId === null || assurance === null)) {
        throw new CustomerPrecreationError("request_failed");
      }
      return {
        status: row.claim_status,
        accountId: row.claim_status === "claimed" || row.claim_status === "already_claimed" ? accountId : null,
        assurance: row.claim_status === "claimed" || row.claim_status === "already_claimed" ? assurance : null,
      };
    },
    async getAssurance(input) {
      assertCustomerPrecreationAssuranceGate(options.writeGate);
      const rows = await requestRpc<{
        account_id: string;
        registration_claimed: boolean;
        phone_verified: boolean;
        email_verified: boolean;
        checkout_ready: boolean;
      }>("customer_account_identity_assurance", {
        p_firebase_uid: input.firebaseUid,
      });
      const row = rows[0];
      if (row === undefined) return { accountId: null, assurance: null };
      const accountId = isSafeUuid(row.account_id) ? row.account_id : null;
      const assurance = parseAssurance(row);
      if (accountId === null || assurance === null) throw new CustomerPrecreationError("request_failed");
      return { accountId, assurance };
    },
    async reconcile(input) {
      const rows = await requestRpc<{
        batch_status: string;
        expected_count: number;
        processed_count: number;
        created_count: number;
        skipped_count: number;
        conflict_count: number;
        failed_count: number;
        drift_count: number;
      }>("reconcile_customer_account_precreation_batch", {
        p_batch_id: input.batchId,
        p_manifest_digest: input.manifestDigest,
      });
      const row = rows[0];
      if (row === undefined || (row.batch_status !== "reconciled" && row.batch_status !== "failed")) {
        throw new CustomerPrecreationError("request_failed");
      }
      return {
        batchStatus: row.batch_status,
        expectedCount: safeCount(row.expected_count),
        processedCount: safeCount(row.processed_count),
        createdCount: safeCount(row.created_count),
        skippedCount: safeCount(row.skipped_count),
        conflictCount: safeCount(row.conflict_count),
        failedCount: safeCount(row.failed_count),
        driftCount: safeCount(row.drift_count),
      };
    },
    async rollback(input) {
      assertCustomerPrecreationBatchGate(options.writeGate, input.manifestDigest);
      const rows = await requestRpc<{ batch_status: string; rolled_back_count: number; claimed_preserved_count: number }>("rollback_customer_account_precreation_batch", {
        p_batch_id: input.batchId,
        p_manifest_digest: input.manifestDigest,
      });
      const row = rows[0];
      if (row === undefined || row.batch_status !== "rolled_back") throw new CustomerPrecreationError("request_failed");
      return {
        batchStatus: "rolled_back" as const,
        rolledBackCount: safeCount(row.rolled_back_count),
        claimedPreservedCount: safeCount(row.claimed_preserved_count),
      };
    },
  };
}

export async function executeCustomerPrecreationBatch(input: Readonly<{
  readonly manifest: CustomerPrecreationManifest;
  readonly auditHmacKey: string;
  readonly approvedBy: string;
  readonly environment: CustomerPrecreationEnvironment;
  readonly repository: CustomerPrecreationRepository;
}>): Promise<Readonly<{
  readonly batchId: string;
  readonly itemResults: readonly CustomerPrecreationBatchItemResult[];
  readonly reconciliation: CustomerPrecreationReconciliation;
}>> {
  verifyCustomerPrecreationManifest(input.manifest, input.auditHmacKey);
  const batch = await input.repository.beginBatch({
    environment: input.environment,
    manifest: input.manifest,
    approvedBy: input.approvedBy,
  });
  const itemResults: CustomerPrecreationBatchItemResult[] = [];
  for (const item of input.manifest.items) {
    const result = await input.repository.precreateItem({
      batchId: batch.batchId,
      manifestDigest: input.manifest.manifestDigest,
      item,
    });
    itemResults.push({ ordinal: item.ordinal, resultCode: result.resultCode });
  }
  const reconciliation = await input.repository.reconcile({
    batchId: batch.batchId,
    manifestDigest: input.manifest.manifestDigest,
  });
  return { batchId: batch.batchId, itemResults, reconciliation };
}

export async function claimPrecreatedCustomer(
  input: Readonly<{
    readonly claim: VerifiedCustomerClaimInput;
    readonly auditHmacKey: string;
    readonly repository: CustomerPrecreationRepository;
  }>,
): Promise<CustomerClaimResult> {
  const claim = input.claim;
  const phone = claim.phoneVerified
    ? normalizeVietnamPhone(claim.verifiedPhoneE164 ?? "")
    : null;
  const email = claim.emailVerified
    ? normalizeClaimEmail(claim.verifiedEmail ?? "")
    : null;
  if ((claim.phoneVerified && phone === null)
    || (claim.emailVerified && email === null)
    || (phone === null && email === null)
    || !isSafeFirebaseUid(claim.firebaseUid)) {
    return { status: "not_claimable", accountId: null, assurance: null };
  }
  return input.repository.claim({
    firebaseUid: claim.firebaseUid,
    phoneDigest: phone === null ? null : lookupDigest(input.auditHmacKey, "phone", phone),
    emailDigest: email === null ? null : lookupDigest(input.auditHmacKey, "email", email),
    policyAcceptances: claim.policyAcceptances ?? [],
  });
}

export async function getCustomerAccountIdentityAssurance(input: Readonly<{
  readonly firebaseUid: string;
  readonly repository: CustomerPrecreationRepository;
}>): Promise<CustomerIdentityAssuranceResult> {
  if (!isSafeFirebaseUid(input.firebaseUid)) return { accountId: null, assurance: null };
  return input.repository.getAssurance({ firebaseUid: input.firebaseUid });
}

export async function rollbackCustomerPrecreationBatch(input: Readonly<{
  readonly manifest: CustomerPrecreationManifest;
  readonly auditHmacKey: string;
  readonly batchId: string;
  readonly repository: CustomerPrecreationRepository;
}>): Promise<Readonly<{ readonly rolledBackCount: number; readonly claimedPreservedCount: number }>> {
  verifyCustomerPrecreationManifest(input.manifest, input.auditHmacKey);
  const result = await input.repository.rollback({
    batchId: input.batchId,
    manifestDigest: input.manifest.manifestDigest,
  });
  return {
    rolledBackCount: result.rolledBackCount,
    claimedPreservedCount: result.claimedPreservedCount,
  };
}

function assertSafeSupabaseHost(url: URL, projectRef: string): void {
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !local) throw new CustomerPrecreationError("invalid_environment");
  if (!/^[a-z0-9-]+$/u.test(projectRef) || (!local && url.hostname !== `${projectRef}.supabase.co`)) {
    throw new CustomerPrecreationError("invalid_environment");
  }
}

function isItemResultCode(value: unknown): value is "created" | "skipped" | "conflict" {
  return value === "created" || value === "skipped" || value === "conflict";
}

function isClaimStatus(value: unknown): value is CustomerClaimResult["status"] {
  return value === "claimed" || value === "already_claimed" || value === "not_claimable" || value === "conflict";
}

function isSafeUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function isSafeFirebaseUid(value: string): boolean {
  return /^[A-Za-z0-9:_-]{1,256}$/u.test(value);
}

function parseAssurance(value: Readonly<Record<string, unknown>>): CustomerIdentityAssurance | null {
  const phoneVerified = value.phone_verified;
  const emailVerified = value.email_verified;
  const checkoutReady = value.checkout_ready;
  const registrationClaimed = value.registration_claimed ?? true;
  if (typeof phoneVerified !== "boolean"
    || typeof emailVerified !== "boolean"
    || typeof checkoutReady !== "boolean"
    || typeof registrationClaimed !== "boolean"
    || checkoutReady !== (phoneVerified && emailVerified)) {
    return null;
  }
  return { registrationClaimed, phoneVerified, emailVerified, checkoutReady };
}

function safeCount(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new CustomerPrecreationError("request_failed");
  return number;
}

export const CUSTOMER_PRECREATION_VERSION = CUSTOMER_PRECREATION_MANIFEST_VERSION;
