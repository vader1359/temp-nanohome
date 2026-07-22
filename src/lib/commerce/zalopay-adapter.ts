import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";


const createResponseSchema = z.object({ return_code: z.number(), order_url: z.string().optional() }).strict();
const queryResponseSchema = z.object({ return_code: z.number(), zp_trans_id: z.string(), amount: z.number() }).strict();
const refundResponseSchema = z.object({ return_code: z.number(), refund_id: z.string().optional() }).strict();
const queryRefundResponseSchema = z.object({ return_code: z.number(), refund_status: z.number() }).strict();
const callbackSchema = z.object({ app_id: z.number(), app_trans_id: z.string(), amount: z.number(), zp_trans_id: z.string().min(1).refine((value) => value.trim().length > 0), return_code: z.number() }).strict();
const verifiedEvidenceKey = Symbol("verified-zalopay-evidence");

export const hasVerifiedZaloPayEvidence = (value: unknown): value is ZaloPayPaymentEvidence =>
  typeof value === "object" && value !== null && Reflect.get(value, verifiedEvidenceKey) === true;

type CreateBody = Readonly<Record<string, number | string>>;
type QueryBody = Readonly<Record<string, number | string>>;
type RefundBody = Readonly<Record<string, number | string>>;

export type ZaloPayGatewayTransport = Readonly<{
  readonly createOrder: (body: CreateBody, mac: string) => Promise<unknown>;
  readonly queryOrder: (body: QueryBody, mac: string) => Promise<unknown>;
  readonly refund: (body: RefundBody, mac: string) => Promise<unknown>;
  readonly queryRefund: (body: QueryBody, mac: string) => Promise<unknown>;
}>;

export type ZaloPayGateway = Readonly<{
  readonly createOrder: (input: ZaloPayCreateInput) => Promise<ZaloPayCreateResult>;
  readonly queryOrder: (input: Readonly<{ readonly orderId: string; readonly appTransId: string; readonly amount: number }>) => Promise<ZaloPayOrderResult>;
  readonly verifyCallback: (input: Readonly<{ readonly data: string; readonly mac: string }>, expected: ZaloPayCallbackExpectation) => ZaloPayCallbackResult;
  readonly refund: (input: ZaloPayRefundInput) => Promise<ZaloPayRefundResult>;
  readonly queryRefund: (input: Readonly<{ readonly merchantRefundId: string }>) => Promise<ZaloPayRefundQueryResult>;
}>;

export type ZaloPayCreateInput = Readonly<{
  readonly orderId: string;
  readonly appTransId: string;
  readonly amount: number;
  readonly appUser: string;
  readonly appTime: number;
  readonly embedData: string;
  readonly item: string;
}>;

export type ZaloPayCreateResult = Readonly<{ readonly kind: "created"; readonly orderUrl: string }> | Readonly<{ readonly kind: "ambiguous" }> | Readonly<{ readonly kind: "rejected" }>;
export type ZaloPayOrderResult = Readonly<{ readonly kind: "paid"; readonly orderId: string; readonly appTransId: string; readonly zpTransId: string; readonly amount: number; readonly evidence: ZaloPayPaymentEvidence }> | Readonly<{ readonly kind: "unpaid" }> | Readonly<{ readonly kind: "processing" }> | Readonly<{ readonly kind: "failed" }> | Readonly<{ readonly kind: "ambiguous" }>;
export type ZaloPayCallbackExpectation = Readonly<{ readonly orderId: string; readonly appTransId: string; readonly amount: number }>;
export type ZaloPayPaymentEvidence = Readonly<{ readonly provider: "zalopay"; readonly orderId: string; readonly appTransId: string; readonly zpTransId: string; readonly amount: number; readonly [verifiedEvidenceKey]: true }>;
export type ZaloPayCallbackResult = Readonly<{ readonly kind: "paid"; readonly orderId: string; readonly appTransId: string; readonly zpTransId: string; readonly amount: number; readonly evidence: ZaloPayPaymentEvidence }> | Readonly<{ readonly kind: "rejected"; readonly reason: "signature" | "payload" | "app_mismatch" | "order_mismatch" | "amount_mismatch" | "not_paid" }>;
export type ZaloPayRefundInput = Readonly<{ readonly appTransId: string; readonly zpTransId: string; readonly amount: number; readonly description: string; readonly merchantRefundId: string }>;
export type ZaloPayRefundResult = Readonly<{ readonly kind: "processing"; readonly merchantRefundId: string }> | Readonly<{ readonly kind: "rejected" }>;
export type ZaloPayRefundQueryResult = Readonly<{ readonly kind: "refunded"; readonly merchantRefundId: string }> | Readonly<{ readonly kind: "processing" }> | Readonly<{ readonly kind: "failed" }>;

const mac = (key: string, input: string): string => createHmac("sha256", key).update(input).digest("hex");
const verifyMac = (key: string, data: string, supplied: string): boolean => {
  const expected = Buffer.from(mac(key, data), "hex");
  const actual = Buffer.from(supplied, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const parseCallback = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
};

export const createZaloPayGateway = (input: Readonly<{ readonly appId: number; readonly key1: string; readonly key2: string; readonly transport: ZaloPayGatewayTransport; readonly clock?: () => Date; readonly nextId?: () => string }>): ZaloPayGateway => {
  return {
    async createOrder(order) {
      const body: CreateBody = { app_id: input.appId, app_trans_id: order.appTransId, app_user: order.appUser, amount: order.amount, app_time: order.appTime, embed_data: order.embedData, item: order.item };
      const response = createResponseSchema.safeParse(await input.transport.createOrder(body, mac(input.key1, [input.appId, order.appTransId, order.appUser, order.amount, order.appTime, order.embedData, order.item].join("|"))));
      if (!response.success) return { kind: "ambiguous" };
      if (response.data.return_code !== 1) return { kind: "rejected" };
      return response.data.order_url === undefined ? { kind: "ambiguous" } : { kind: "created", orderUrl: response.data.order_url };
    },
    async queryOrder(order) {
      const body: QueryBody = { app_id: input.appId, app_trans_id: order.appTransId };
      const response = queryResponseSchema.safeParse(await input.transport.queryOrder(body, mac(input.key1, [input.appId, order.appTransId, input.key1].join("|"))));
      if (!response.success) return { kind: "ambiguous" };
      if (response.data.return_code !== 1) {
        if (response.data.return_code === 3) return { kind: "processing" };
        return response.data.return_code === 0 ? { kind: "unpaid" } : { kind: "failed" };
      }
      if (response.data.amount === order.amount && response.data.zp_trans_id.length > 0) {
        const evidence: ZaloPayPaymentEvidence = {
          provider: "zalopay",
          orderId: order.orderId,
          appTransId: order.appTransId,
          zpTransId: response.data.zp_trans_id,
          amount: response.data.amount,
          [verifiedEvidenceKey]: true,
        };
        return { kind: "paid", orderId: order.orderId, appTransId: order.appTransId, zpTransId: response.data.zp_trans_id, amount: response.data.amount, evidence };
      }
      return { kind: "ambiguous" };
    },
    verifyCallback(callback, expected) {
      if (!verifyMac(input.key2, callback.data, callback.mac)) return { kind: "rejected", reason: "signature" };
      const parsed = callbackSchema.safeParse(parseCallback(callback.data));
      if (!parsed.success) return { kind: "rejected", reason: "payload" };
      if (parsed.data.app_id !== input.appId) return { kind: "rejected", reason: "app_mismatch" };
      if (parsed.data.app_trans_id !== expected.appTransId) return { kind: "rejected", reason: "order_mismatch" };
      if (parsed.data.amount !== expected.amount) return { kind: "rejected", reason: "amount_mismatch" };
      if (parsed.data.return_code !== 1) return { kind: "rejected", reason: "not_paid" };
      const evidence = { provider: "zalopay", orderId: expected.orderId, appTransId: parsed.data.app_trans_id, zpTransId: parsed.data.zp_trans_id, amount: parsed.data.amount, [verifiedEvidenceKey]: true } satisfies ZaloPayPaymentEvidence;
      return { kind: "paid", orderId: expected.orderId, appTransId: parsed.data.app_trans_id, zpTransId: parsed.data.zp_trans_id, amount: parsed.data.amount, evidence };
    },
    async refund(order) {
      const body: RefundBody = { app_id: input.appId, m_refund_id: order.merchantRefundId, zp_trans_id: order.zpTransId, amount: order.amount, timestamp: Date.now(), description: order.description };
      const response = refundResponseSchema.safeParse(await input.transport.refund(body, mac(input.key1, [input.appId, order.zpTransId, order.amount, input.key1].join("|"))));
      return response.success && response.data.return_code === 1 ? { kind: "processing", merchantRefundId: order.merchantRefundId } : { kind: "rejected" };
    },
    async queryRefund(refund) {
      const body: QueryBody = { app_id: input.appId, m_refund_id: refund.merchantRefundId };
      const response = queryRefundResponseSchema.safeParse(await input.transport.queryRefund(body, mac(input.key1, [input.appId, refund.merchantRefundId, input.key1].join("|"))));
      if (!response.success) return { kind: "processing" };
      if (response.data.refund_status === 2) return { kind: "refunded", merchantRefundId: refund.merchantRefundId };
      return response.data.refund_status === 1 ? { kind: "processing" } : { kind: "failed" };
    },
  };
};
