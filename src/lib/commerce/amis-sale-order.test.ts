import { describe, expect, it } from "vitest";

import {
  createAmisSaleOrderGateway,
  type AmisSaleOrderHttpPort,
  type CanonicalAmisDraft,
} from "./amis-sale-order";

const draft: CanonicalAmisDraft = {
  orderNumber: "WEB-20260722-0001",
  customer: { id: "WEB-CUSTOMER", name: "Website customer" },
  warehouse: { id: "WH-1", name: "Website warehouse" },
  lines: [{ rawSku: "CHAIR-RAW 01", quantity: 2, unitPrice: 100, taxRate: 0 }],
  total: 200,
};

function fakeHttp(responses: readonly { status: number; body: unknown }[]): AmisSaleOrderHttpPort {
  let index = 0;
  return {
    requests: [],
    async send(request) {
      this.requests.push(request);
      const response = responses[index];
      index += 1;
      if (response === undefined) throw new Error("missing fake response");
      return response;
    },
    async refreshToken() { return "token-refreshed"; },
  };
}

describe("createAmisSaleOrderGateway", () => {
  it("refreshes once when findByCode receives an expired token", async () => {
    const http = fakeHttp([
      { status: 401, body: null },
      { status: 200, body: { success: true, code: 200, data: [{ id: 9, sale_order_no: draft.orderNumber }] } },
    ]);
    const gateway = createAmisSaleOrderGateway({ http, featureEnabled: true, tenantCapability: true });

    const result = await gateway.findByCode(draft.orderNumber);

    expect(result).toEqual({ kind: "found", id: 9, orderNumber: draft.orderNumber });
    expect(http.requests).toHaveLength(2);
    expect(http.requests[1]?.token).toBe("token-refreshed");
  });

  it("denies by default when the feature and tenant capability are absent", async () => {
    const http = fakeHttp([]);
    const gateway = createAmisSaleOrderGateway({ http });

    const result = await gateway.createDraft(draft);

    expect(result).toEqual({ kind: "denied", reason: "capability_not_enabled" });
    expect(http.requests).toHaveLength(0);
  });

  it("sends a canonical WEB draft with exact raw SKU and warehouse snapshot", async () => {
    const http = fakeHttp([{ status: 200, body: { success: true, code: 200, data: { id: 7, sale_order_no: draft.orderNumber } } }]);
    const gateway = createAmisSaleOrderGateway({ http, featureEnabled: true, tenantCapability: true, writeCapability: true });

    const result = await gateway.createDraft(draft);

    expect(result).toEqual({ kind: "created", id: 7, orderNumber: draft.orderNumber });
    expect(http.requests[0]).toMatchObject({ method: "POST", path: "/api/v2/SaleOrders", token: "token" });
    expect(http.requests[0]?.body).toMatchObject({ sale_order_no: draft.orderNumber, warehouse_id: "WH-1", warehouse_name: "Website warehouse" });
    expect(http.requests[0]?.body).toMatchObject({ sale_order_product_mappings: [{ product_code: "CHAIR-RAW 01", quantity: 2 }] });
  });

  const reconciliationFailures: readonly ["timeout", "http-5xx", "duplicate"] = ["timeout", "http-5xx", "duplicate"];
  it.each(reconciliationFailures)("reconciles %s without blind retry", async (failure) => {
    const http = fakeHttp(failure === "duplicate"
      ? [{ status: 409, body: { success: false, code: 409, data: null } }, { status: 200, body: { success: true, code: 200, data: [{ id: 8, sale_order_no: draft.orderNumber }] } }]
      : [{ status: failure === "http-5xx" ? 503 : 599, body: null }, { status: 200, body: { success: true, code: 200, data: [{ id: 8, sale_order_no: draft.orderNumber }] } }]);
    const gateway = createAmisSaleOrderGateway({ http, featureEnabled: true, tenantCapability: true, writeCapability: true });

    const result = await gateway.createDraft(draft);

    expect(result).toEqual({ kind: "reconciled", id: 8, orderNumber: draft.orderNumber });
    expect(http.requests.filter((request) => request.method === "POST")).toHaveLength(1);
    expect(http.requests[1]).toMatchObject({ method: "GET", path: "/api/v2/SaleOrders", query: { sale_order_no: draft.orderNumber } });
  });

  it("rejects malformed success and refreshes a token at most once", async () => {
    const http = fakeHttp([{ status: 401, body: null }, { status: 200, body: { success: true, code: 200, data: {} } }]);
    const gateway = createAmisSaleOrderGateway({ http, featureEnabled: true, tenantCapability: true, writeCapability: true });

    const result = await gateway.createDraft(draft);

    expect(result.kind).toBe("malformed");
    expect(http.requests).toHaveLength(2);
  });

  it("denies the draft write when its independent capability is absent", async () => {
    const http = fakeHttp([]);
    const gateway = createAmisSaleOrderGateway({ http, featureEnabled: true, tenantCapability: true });

    const result = await gateway.createDraft(draft);

    expect(result).toEqual({ kind: "denied", reason: "capability_not_enabled" });
    expect(http.requests).toHaveLength(0);
  });
});
