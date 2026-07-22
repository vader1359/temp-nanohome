import { describe, expect, it } from "vitest";

import { createAmisSaleOrderWriteCapability } from "./amis-capability";

const tenantProof = {
  readonly: false,
  tenantId: "tenant-1",
  stockReadProven: true,
  saleOrderWriteProven: true,
};

describe("AMIS Sale Order write capability", () => {
  it("allows only the exact POST SaleOrders capability", () => {
    const result = createAmisSaleOrderWriteCapability({
      origin: "https://api.example.test",
      tenantProof,
      featureEnabled: true,
    });

    expect(result.kind).toBe("allowed");
    if (result.kind === "allowed") {
      expect(result.capability.methods).toEqual(["POST"]);
      expect(result.capability.paths).toEqual(["/api/v2/SaleOrders"]);
    }
  });

  it("denies before capability construction without write proof", () => {
    const result = createAmisSaleOrderWriteCapability({
      origin: "https://api.example.test",
      tenantProof: { ...tenantProof, saleOrderWriteProven: false },
      featureEnabled: true,
    });

    expect(result).toEqual({ kind: "denied", reason: "tenant_proof_required" });
  });
});
