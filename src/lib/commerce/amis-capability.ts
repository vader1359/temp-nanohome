import { createRemoteCapability, type RemoteCapability } from "@/lib/remote-capabilities";

export type AmisTenantProof = {
  readonly readonly: boolean;
  readonly tenantId: string;
  readonly stockReadProven: boolean;
  readonly saleOrderWriteProven?: boolean;
};

export type AmisCapabilityResult =
  | { readonly kind: "allowed"; readonly capability: RemoteCapability }
  | { readonly kind: "denied"; readonly reason: "tenant_proof_required" | "invalid_origin" };

export function createAmisReadCapability(input: {
  readonly origin: string;
  readonly tenantProof: AmisTenantProof;
}): AmisCapabilityResult {
  if (!input.tenantProof.readonly || !input.tenantProof.stockReadProven || input.tenantProof.tenantId.trim() === "") {
    return { kind: "denied", reason: "tenant_proof_required" };
  }
  try {
    return { kind: "allowed", capability: createCapability(input.origin) };
  } catch (error) {
    if (error instanceof Error) return { kind: "denied", reason: "invalid_origin" };
    throw error;
  }
}

export function createAmisSaleOrderWriteCapability(input: {
  readonly origin: string;
  readonly tenantProof: AmisTenantProof;
  readonly featureEnabled: boolean;
}): AmisCapabilityResult {
  if (!input.featureEnabled || input.tenantProof.saleOrderWriteProven !== true || input.tenantProof.tenantId.trim() === "") {
    return { kind: "denied", reason: "tenant_proof_required" };
  }
  try {
    return { kind: "allowed", capability: createWriteCapability(input.origin) };
  } catch (error) {
    if (error instanceof Error) return { kind: "denied", reason: "invalid_origin" };
    throw error;
  }
}

function createCapability(origin: string): RemoteCapability {
  return createRemoteCapability({
    origin,
    methods: ["GET"],
    paths: ["/api/v2/Stocks/product_ledger"],
    purpose: "Read selected-warehouse AMIS stock ledger",
    owner: "commerce-stock-reader",
    responseContentTypes: ["application/json"],
    maxResponseBytes: 1_000_000,
    timeoutMs: 20_000,
  });
}

function createWriteCapability(origin: string): RemoteCapability {
  return createRemoteCapability({
    origin,
    methods: ["POST"],
    paths: ["/api/v2/SaleOrders"],
    purpose: "Create AMIS draft sale order",
    owner: "commerce-sale-order-writer",
    responseContentTypes: ["application/json"],
    maxResponseBytes: 1_000_000,
    timeoutMs: 20_000,
  });
}
