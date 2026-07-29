import { z } from "zod";

import { getAccountAuthPort } from "@/lib/account/account-ports.server";
import { getSePayTestRepository } from "@/lib/payments/sepay/runtime.server";

const orderIdSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const orderId = orderIdSchema.safeParse((await params).orderId);
  if (!orderId.success) return Response.json({ error: "not_found" }, { status: 404 });

  try {
    const status = await getSePayTestRepository().getPaymentStatus(
      account.accountId,
      orderId.data,
    );
    return status === null
      ? Response.json({ error: "not_found" }, { status: 404 })
      : Response.json(status, { status: 200 });
  } catch {
    return Response.json({ error: "payment_unavailable" }, { status: 503 });
  }
}
