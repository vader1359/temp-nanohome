import { env } from "@/lib/env";
import {
  authenticateSePayIpn,
  matchSePayIpnToExpectedPayment,
  maximumSePayIpnBodyBytes,
  type SePayIpnRejectionReason,
} from "@/lib/payments/sepay/ipn";
import { SePayTestRepositoryError } from "@/lib/payments/sepay/repository.server";
import {
  getSePayTestRepository,
  isSePaySandboxRuntimeEnabled,
} from "@/lib/payments/sepay/runtime.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rejected(reason: SePayIpnRejectionReason): Response {
  const status = reason === "configuration_missing"
    ? 503
    : reason === "body_too_large"
      ? 413
      : reason === "invalid_payload" || reason === "payment_mismatch"
        ? 400
        : 401;
  return Response.json({ error: reason, success: false }, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSePaySandboxRuntimeEnabled()) {
    return Response.json({ error: "payment_disabled", success: false }, { status: 503 });
  }

  let rawBody: string;
  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > maximumSePayIpnBodyBytes) {
      return rejected("body_too_large");
    }
    rawBody = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return rejected("invalid_payload");
  }

  const authenticated = authenticateSePayIpn({
    nowSeconds: Math.floor(Date.now() / 1000),
    rawBody,
    secret: env.SEPAY_WEBHOOK_HMAC_SECRET,
    signature: request.headers.get("x-sepay-signature"),
    timestamp: request.headers.get("x-sepay-timestamp"),
  });
  if (authenticated.kind === "rejected") return rejected(authenticated.reason);

  try {
    const repository = getSePayTestRepository();
    const expected = await repository.getExpectedPayment(
      authenticated.transfer.merchantReference,
    );
    if (expected === null) return rejected("payment_mismatch");

    const verified = matchSePayIpnToExpectedPayment(authenticated.transfer, expected);
    if (verified.kind === "rejected") return rejected(verified.reason);

    const result = await repository.applyVerifiedIpn({
      amount: verified.evidence.amount,
      merchantReference: verified.evidence.merchantReference,
      payloadDigest: verified.payloadDigest,
      providerEventId: verified.providerEventId,
      providerTransactionId: verified.providerTransactionId,
      receivedAt: new Date(),
    });
    if (result === "applied") {
      return Response.json({ success: true }, { status: 201 });
    }
    if (result === "duplicate") {
      return Response.json({ success: true }, { status: 200 });
    }
    return Response.json({ error: "payment_conflict", success: false }, { status: 409 });
  } catch (error) {
    if (error instanceof SePayTestRepositoryError && error.code === "mutation_disabled") {
      return Response.json({ error: "payment_disabled", success: false }, { status: 503 });
    }
    return Response.json({ error: "payment_unavailable", success: false }, { status: 503 });
  }
}
