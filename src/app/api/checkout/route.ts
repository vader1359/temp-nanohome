import { getAccountAuthPort } from "@/lib/account/account-ports.server";
import {
  AccountCheckoutRepositoryError,
} from "@/lib/checkout/account-checkout-repository.server";
import {
  resolveCheckoutIdentity,
  resolveCheckoutOrderContact,
} from "@/lib/checkout/checkout-identity";
import { getAccountCheckoutRepository } from "@/lib/checkout/account-checkout-runtime.server";
import { checkoutRequestSchema } from "@/lib/checkout/delivery";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginPost(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const identity = resolveCheckoutIdentity(account);
  if (identity.kind === "identity_required") {
    return Response.json({
      error: "identity_required",
      missing: identity.missing,
      returnTo: `/${account.locale}/checkout`,
    }, { status: 409 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = checkoutRequestSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: "invalid_checkout_data" }, { status: 400 });
  }
  const contact = resolveCheckoutOrderContact(identity.identity, {
    email: parsed.data.delivery.email,
    phone: parsed.data.delivery.phone,
  });
  if (contact.kind === "invalid_contact") {
    return Response.json({ error: "invalid_checkout_data" }, { status: 400 });
  }
  if (contact.kind === "verified_contact_mismatch") {
    return Response.json({ error: "verified_contact_mismatch" }, { status: 409 });
  }

  const checkoutInput = {
    address: parsed.data.delivery.address,
    city: parsed.data.delivery.city,
    district: parsed.data.delivery.district,
    email: contact.contact.email,
    fullName: parsed.data.delivery.fullName,
    idempotencyKey: parsed.data.idempotencyKey,
    note: parsed.data.vat === null
      ? undefined
      : `VAT: ${parsed.data.vat.companyName} | ${parsed.data.vat.taxCode} | ${parsed.data.vat.address}`,
    ward: parsed.data.delivery.ward,
    phone: contact.contact.phoneE164,
  };

  try {
    const order = await getAccountCheckoutRepository().captureOrder(
      account.accountId,
      checkoutInput,
    );
    return Response.json({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      replayed: order.replayed,
      next: "initialize_payment",
    }, { status: order.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof AccountCheckoutRepositoryError) {
      if (error.code === "mutation_disabled") {
        return Response.json({ error: "checkout_disabled" }, { status: 503 });
      }
      if (error.code === "checkout_cart_not_found"
        || error.code === "checkout_empty_cart"
        || error.code === "checkout_invalid_cart"
        || error.code === "checkout_idempotency_conflict") {
        return Response.json({ error: error.code }, { status: 409 });
      }
      if (error.code === "checkout_invalid_request") {
        return Response.json({ error: "invalid_checkout_data" }, { status: 400 });
      }
      if (error.code === "checkout_unauthorized") {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
    }
    return Response.json({ error: "checkout_failed" }, { status: 500 });
  }
}
