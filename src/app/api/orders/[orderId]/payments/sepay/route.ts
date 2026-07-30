import { z } from "zod";

import { getAccountAuthPort } from "@/lib/account/account-ports.server";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { SEPAY_TEST_VIETQR_URL } from "@/lib/payments/sepay/checkout";
import {
  createSePayTestModeVietQr,
} from "@/lib/payments/sepay/test-mode-client.server";
import { SePayTestRepositoryError } from "@/lib/payments/sepay/repository.server";
import {
  getSePayTestModeRuntimeConfig,
  getSePayTestRepository,
  isSePaySandboxRuntimeEnabled,
} from "@/lib/payments/sepay/runtime.server";

const orderIdSchema = z.string().uuid();
const paymentInitSchema = z.object({
  idempotencyKey: z.string().uuid(),
  returnUrlsVersion: z.literal("v1"),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  if (!isSameOriginPost(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isSePaySandboxRuntimeEnabled()) {
    return Response.json({ error: "payment_disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_payment_request" }, { status: 400 });
  }
  const parsedBody = paymentInitSchema.safeParse(body);
  if (!parsedBody.success) {
    return Response.json({ error: "invalid_payment_request" }, { status: 400 });
  }

  const parsedOrderId = orderIdSchema.safeParse((await params).orderId);
  if (!parsedOrderId.success) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const attempt = await getSePayTestRepository().createAttempt(
      account.accountId,
      parsedOrderId.data,
      parsedBody.data.idempotencyKey,
    );
    if (attempt.state === "failed"
      || attempt.state === "expired"
      || attempt.state === "cancelled") {
      return Response.json({ error: "payment_not_payable" }, { status: 409 });
    }
    if (attempt.state === "succeeded") {
      return Response.json({ error: "payment_already_paid" }, { status: 409 });
    }
    if (attempt.providerCheckoutUrl !== SEPAY_TEST_VIETQR_URL
      || attempt.providerOrderId !== attempt.merchantReference
      || Number.isNaN(Date.parse(attempt.expiresAt))) {
      return Response.json({ error: "payment_not_available" }, { status: 503 });
    }
    const config = getSePayTestModeRuntimeConfig();
    if (config === null) return Response.json({ error: "payment_disabled" }, { status: 503 });
    const checkout = await createSePayTestModeVietQr({
      amount: attempt.amount,
      apiBaseUrl: config.apiBaseUrl,
      apiToken: config.apiToken,
      bankAccountId: config.bankAccountId,
      merchantReference: attempt.merchantReference,
    });
    return Response.json({
      payment: {
        amount: attempt.amount,
        attemptId: attempt.attemptId,
        currency: "VND",
        environment: "sandbox",
        expiresAt: attempt.expiresAt,
        handoff: "vietqr",
        merchantReference: attempt.merchantReference,
        paymentUrl: checkout.paymentUrl,
        state: "pending",
      },
    }, { status: attempt.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof SePayTestRepositoryError && error.code === "mutation_disabled") {
      return Response.json({ error: "payment_disabled" }, { status: 503 });
    }
    return Response.json({ error: "payment_not_available" }, { status: 404 });
  }
}
