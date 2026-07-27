import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { createVerifiedPaymentEvidence, type VerifiedPaymentEvidence } from "../contracts";

const delayedThresholdMilliseconds = 15 * 60 * 1000;

export const maximumSePayIpnBodyBytes = 32 * 1024;

const amountSchema = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().safe().int().positive());

const sePayIpnSchema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  notification_type: z.literal("ORDER_PAID"),
  order: z.object({
    order_status: z.literal("CAPTURED"),
    order_currency: z.literal("VND"),
    order_amount: amountSchema,
    order_invoice_number: z.string().min(1),
  }).strict(),
  transaction: z.object({
    id: z.string().min(1),
    transaction_id: z.string().min(1),
    payment_method: z.string().min(1),
    transaction_status: z.literal("APPROVED"),
    amount: amountSchema,
    currency: z.literal("VND"),
  }).strict(),
  customer: z.object({ id: z.string().min(1) }).strict(),
}).strict();

type SePayIpn = z.infer<typeof sePayIpnSchema>;

type ExpectedPayment = Readonly<{
  readonly merchantReference: string;
  readonly amount: number;
  readonly currency: "VND";
}>;

export type SePayIpnVerificationResult =
  | Readonly<{
      readonly kind: "verified";
      readonly evidence: VerifiedPaymentEvidence;
      readonly providerEventId: string;
      readonly delayed: boolean;
    }>
  | Readonly<{ readonly kind: "rejected" }>;

export type VerifySePayIpnInput = Readonly<{
  readonly rawBody: string;
  readonly secret: string;
  readonly suppliedSecret: string | null;
  readonly receivedAt: Date;
  readonly expected: ExpectedPayment;
}>;

const parseIpn = (rawBody: string): SePayIpn | null => {
  try {
    return sePayIpnSchema.safeParse(JSON.parse(rawBody)).data ?? null;
  } catch {
    return null;
  }
};

const secretsMatch = (expected: string, supplied: string | null): boolean => {
  if (supplied === null) return false;
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
};

const matchesExpectedPayment = (ipn: SePayIpn, expected: ExpectedPayment): boolean =>
  ipn.order.order_invoice_number === expected.merchantReference
  && ipn.order.order_amount === expected.amount
  && ipn.order.order_currency === expected.currency
  && ipn.transaction.amount === expected.amount
  && ipn.transaction.currency === expected.currency;

export const verifySePayIpn = (input: VerifySePayIpnInput): SePayIpnVerificationResult => {
  if (Buffer.byteLength(input.rawBody, "utf8") > maximumSePayIpnBodyBytes) return { kind: "rejected" };
  if (!secretsMatch(input.secret, input.suppliedSecret)) return { kind: "rejected" };
  const ipn = parseIpn(input.rawBody);
  if (ipn === null || !matchesExpectedPayment(ipn, input.expected)) return { kind: "rejected" };

  const sentAt = new Date(ipn.timestamp);
  const delayed = input.receivedAt.getTime() - sentAt.getTime() > delayedThresholdMilliseconds;
  return {
    kind: "verified",
    evidence: createVerifiedPaymentEvidence({
      provider: "sepay",
      merchantReference: ipn.order.order_invoice_number,
      providerTransactionId: ipn.transaction.transaction_id,
      amount: ipn.transaction.amount,
      currency: ipn.transaction.currency,
    }),
    providerEventId: ipn.transaction.id,
    delayed,
  };
};
