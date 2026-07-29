import { z } from "zod";

import { getAccountAuthPort } from "@/lib/account/account-ports.server";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { buildSePayTestPaymentInstruction } from "@/lib/payments/sepay/checkout";
import { SePayTestRepositoryError } from "@/lib/payments/sepay/repository.server";
import {
  getSePayTestRepository,
  isSePaySandboxRuntimeEnabled,
} from "@/lib/payments/sepay/runtime.server";

const orderIdSchema = z.string().uuid();

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

  const parsedOrderId = orderIdSchema.safeParse((await params).orderId);
  if (!parsedOrderId.success) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const attempt = await getSePayTestRepository().createAttempt(
      account.accountId,
      parsedOrderId.data,
    );
    if (attempt.state === "failed"
      || attempt.state === "expired"
      || attempt.state === "cancelled") {
      return Response.json({ error: "payment_not_payable" }, { status: 409 });
    }
    const instruction = buildSePayTestPaymentInstruction({
      amount: attempt.amount,
      currency: attempt.currency,
      merchantReference: attempt.merchantReference,
      paymentState: attempt.state === "succeeded" ? "paid" : "pending",
    });
    return Response.json({ payment: instruction }, { status: attempt.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof SePayTestRepositoryError && error.code === "mutation_disabled") {
      return Response.json({ error: "payment_disabled" }, { status: 503 });
    }
    return Response.json({ error: "payment_not_available" }, { status: 404 });
  }
}
