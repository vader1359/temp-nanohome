import { z } from "zod";

export type CanonicalAmisDraft = {
  readonly orderNumber: string;
  readonly customer: { readonly id: string; readonly name: string };
  readonly warehouse: { readonly id: string; readonly name: string };
  readonly lines: readonly { readonly rawSku: string; readonly quantity: number; readonly unitPrice: number; readonly taxRate: number }[];
  readonly total: number;
};

export type AmisSaleOrderRequest = {
  readonly method: "POST" | "GET";
  readonly path: "/api/v2/SaleOrders";
  readonly token: string;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly query?: Readonly<Record<string, string>>;
};

export type AmisSaleOrderHttpPort = {
  readonly requests: AmisSaleOrderRequest[];
  send(request: AmisSaleOrderRequest): Promise<{ readonly status: number; readonly body: unknown }>;
  refreshToken(): Promise<string>;
};

export type CreateDraftResult =
  | { readonly kind: "created" | "reconciled"; readonly id: number; readonly orderNumber: string }
  | { readonly kind: "denied"; readonly reason: "capability_not_enabled" }
  | { readonly kind: "malformed"; readonly message: string }
  | { readonly kind: "not_found"; readonly orderNumber: string };

export type FindDraftResult =
  | { readonly kind: "found"; readonly id: number; readonly orderNumber: string }
  | { readonly kind: "not_found"; readonly orderNumber: string }
  | { readonly kind: "malformed"; readonly message: string }
  | { readonly kind: "denied"; readonly reason: "capability_not_enabled" };

export type AmisSaleOrderGateway = {
  createDraft(input: CanonicalAmisDraft): Promise<CreateDraftResult>;
  findByCode(orderNumber: string): Promise<FindDraftResult>;
};

const responseSchema = z.object({
  success: z.boolean(),
  code: z.number().int(),
  data: z.object({ id: z.number().int(), sale_order_no: z.string().min(1) }).nullable(),
});
const findResponseSchema = z.object({
  success: z.boolean(),
  code: z.number().int(),
  data: z.array(z.object({ id: z.number().int(), sale_order_no: z.string().min(1) })),
});

export function createAmisSaleOrderGateway(input: {
  readonly http: AmisSaleOrderHttpPort;
  readonly featureEnabled?: boolean;
  readonly tenantCapability?: boolean;
  readonly writeCapability?: boolean;
}): AmisSaleOrderGateway {
  const readEnabled = input.featureEnabled === true && input.tenantCapability === true;
  const writeEnabled = readEnabled && input.writeCapability === true;
  let token = "token";
  return {
    async createDraft(draft) {
      if (!writeEnabled) return { kind: "denied", reason: "capability_not_enabled" };
      const request = { method: "POST", path: "/api/v2/SaleOrders", token, body: toPayload(draft) } satisfies AmisSaleOrderRequest;
      const response = await sendWithRefresh(input.http, request);
      if (response.status >= 500 || response.status === 599 || response.status === 409) {
        const reconciliation = await sendWithRefresh(input.http, { method: "GET", path: "/api/v2/SaleOrders", token, query: { sale_order_no: draft.orderNumber } });
        const result = parseFindResponse(reconciliation, draft.orderNumber);
        return result.kind === "found" ? { kind: "reconciled", id: result.id, orderNumber: result.orderNumber } : result;
      }
      const parsed = responseSchema.safeParse(response.body);
      if (!parsed.success || !parsed.data.success || parsed.data.code !== 200 || parsed.data.data === null || parsed.data.data.sale_order_no !== draft.orderNumber) {
        return { kind: "malformed", message: "AMIS Sale Order response is malformed" };
      }
      return { kind: "created", id: parsed.data.data.id, orderNumber: parsed.data.data.sale_order_no };
    },
    async findByCode(orderNumber) {
      if (!readEnabled) return { kind: "denied", reason: "capability_not_enabled" };
      const request = { method: "GET", path: "/api/v2/SaleOrders", token, query: { sale_order_no: orderNumber } } satisfies AmisSaleOrderRequest;
      return parseFindResponse(await sendWithRefresh(input.http, request), orderNumber);
    },
  };

  async function sendWithRefresh(http: AmisSaleOrderHttpPort, request: AmisSaleOrderRequest): Promise<{ readonly status: number; readonly body: unknown }> {
    let refreshed = false;
    let response = await http.send(request);
    if (response.status === 401 && !refreshed) {
      token = await http.refreshToken();
      refreshed = true;
      response = await http.send({ ...request, token });
    }
    return response;
  }

}

function toPayload(draft: CanonicalAmisDraft): Readonly<Record<string, unknown>> {
  return {
    sale_order_no: draft.orderNumber,
    customer_id: draft.customer.id,
    customer_name: draft.customer.name,
    warehouse_id: draft.warehouse.id,
    warehouse_name: draft.warehouse.name,
    revenue_status: "draft",
    sale_order_product_mappings: draft.lines.map((line) => ({ product_code: line.rawSku, quantity: line.quantity, unit_price: line.unitPrice, tax_rate: line.taxRate })),
    total_amount: draft.total,
  };
}

function parseFindResponse(response: { readonly status: number; readonly body: unknown }, orderNumber: string): FindDraftResult {
  const parsed = findResponseSchema.safeParse(response.body);
  if (!parsed.success || !parsed.data.success || parsed.data.code !== 200) return { kind: "malformed", message: "AMIS Sale Order response is malformed" };
  const match = parsed.data.data.find((order) => order.sale_order_no === orderNumber);
  return match === undefined ? { kind: "not_found", orderNumber } : { kind: "found", id: match.id, orderNumber: match.sale_order_no };
}
