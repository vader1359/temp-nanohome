import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { createVerifiedPaymentEvidence, type VerifiedPaymentEvidence } from "../contracts";

const maximumTimestampSkewSeconds = 5 * 60;
export const maximumSePayIpnBodyBytes = 32 * 1024;

const eventIdSchema = z.union([
  z.number().int().safe().positive().transform(String),
  z.string().trim().min(1).max(256),
]);

const sePayInboundTransferSchema = z.object({
  id: eventIdSchema,
  code: z.string().trim().min(1).max(256),
  referenceCode: z.string().trim().min(1).max(256),
  transferAmount: z.number().int().safe().positive(),
  transferType: z.literal("in"),
}).passthrough();

type ExpectedPayment = Readonly<{
  readonly amount: number;
  readonly currency: "VND";
  readonly environment: "sandbox";
  readonly merchantReference: string;
}>;

export type SePayIpnRejectionReason =
  | "body_too_large"
  | "configuration_missing"
  | "expired_timestamp"
  | "invalid_payload"
  | "invalid_signature"
  | "invalid_timestamp"
  | "missing_signature"
  | "missing_timestamp"
  | "payment_mismatch";

export type SePayIpnVerificationResult =
  | Readonly<{
      readonly kind: "verified";
      readonly evidence: VerifiedPaymentEvidence;
      readonly payloadDigest: string;
      readonly providerEventId: string;
      readonly providerTransactionId: string;
    }>
  | Readonly<{ readonly kind: "rejected"; readonly reason: SePayIpnRejectionReason }>;

type AuthenticateSePayIpnInput = Readonly<{
  readonly nowSeconds: number;
  readonly rawBody: string;
  readonly secret: string | undefined;
  readonly signature: string | null;
  readonly timestamp: string | null;
}>;

export type VerifySePayIpnInput = AuthenticateSePayIpnInput & Readonly<{
  readonly expected: ExpectedPayment;
}>;

export type AuthenticatedSePayIpn = Readonly<{
  readonly amount: number;
  readonly merchantReference: string;
  readonly payloadDigest: string;
  readonly providerEventId: string;
  readonly providerTransactionId: string;
}>;

export type AuthenticateSePayIpnResult =
  | Readonly<{ readonly kind: "authenticated"; readonly transfer: AuthenticatedSePayIpn }>
  | Readonly<{ readonly kind: "rejected"; readonly reason: SePayIpnRejectionReason }>;

function constantTimeTextEqual(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied.trim(), "utf8");
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function authenticate(input: AuthenticateSePayIpnInput): SePayIpnRejectionReason | null {
  if (Buffer.byteLength(input.rawBody, "utf8") > maximumSePayIpnBodyBytes) {
    return "body_too_large";
  }
  if (input.secret === undefined || input.secret.length === 0) return "configuration_missing";
  if (input.signature === null || input.signature.trim().length === 0) return "missing_signature";
  if (input.timestamp === null || input.timestamp.trim().length === 0) return "missing_timestamp";

  const timestamp = Number(input.timestamp);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return "invalid_timestamp";
  if (Math.abs(input.nowSeconds - timestamp) > maximumTimestampSkewSeconds) {
    return "expired_timestamp";
  }
  if (!/^sha256=[0-9a-f]{64}$/.test(input.signature.trim())) return "invalid_signature";

  const expectedSignature = `sha256=${createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.rawBody}`, "utf8")
    .digest("hex")}`;
  return constantTimeTextEqual(expectedSignature, input.signature)
    ? null
    : "invalid_signature";
}

export function authenticateSePayIpn(
  input: AuthenticateSePayIpnInput,
): AuthenticateSePayIpnResult {
  const authenticationFailure = authenticate(input);
  if (authenticationFailure !== null) {
    return { kind: "rejected", reason: authenticationFailure };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    return { kind: "rejected", reason: "invalid_payload" };
  }
  const parsed = sePayInboundTransferSchema.safeParse(payload);
  if (!parsed.success) return { kind: "rejected", reason: "invalid_payload" };

  return {
    kind: "authenticated",
    transfer: {
      amount: parsed.data.transferAmount,
      merchantReference: parsed.data.code,
      payloadDigest: createHash("sha256").update(input.rawBody, "utf8").digest("hex"),
      providerEventId: parsed.data.id,
      providerTransactionId: parsed.data.referenceCode,
    },
  };
}

export function matchSePayIpnToExpectedPayment(
  transfer: AuthenticatedSePayIpn,
  expected: ExpectedPayment,
): SePayIpnVerificationResult {
  if (expected.environment !== "sandbox"
    || expected.currency !== "VND"
    || transfer.merchantReference !== expected.merchantReference
    || transfer.amount !== expected.amount) {
    return { kind: "rejected", reason: "payment_mismatch" };
  }

  return {
    evidence: createVerifiedPaymentEvidence({
      amount: transfer.amount,
      currency: "VND",
      merchantReference: transfer.merchantReference,
      provider: "sepay",
      providerTransactionId: transfer.providerTransactionId,
    }),
    kind: "verified",
    payloadDigest: transfer.payloadDigest,
    providerEventId: transfer.providerEventId,
    providerTransactionId: transfer.providerTransactionId,
  };
}

export function verifySePayIpn(input: VerifySePayIpnInput): SePayIpnVerificationResult {
  const { expected, ...authenticationInput } = input;
  const authenticated = authenticateSePayIpn(authenticationInput);
  return authenticated.kind === "rejected"
    ? authenticated
    : matchSePayIpnToExpectedPayment(authenticated.transfer, expected);
}
