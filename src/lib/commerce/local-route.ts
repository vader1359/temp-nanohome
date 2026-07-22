import { cartInputSchema, checkoutInputSchema, ownerSchema, type CommerceLocalServices } from "./commerce-local";

const json = (body: Readonly<Record<string, unknown>>, status: number): Response => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const parseBody = async (request: Request): Promise<unknown> => { try { return await request.json(); } catch { return null; } };
const ownerFromHeader = (request: Request) => ownerSchema.safeParse({ kind: request.headers.get("x-commerce-owner-kind"), id: request.headers.get("x-commerce-owner-id") });

export const createCartRoute = (services: CommerceLocalServices) => async (request: Request): Promise<Response> => {
  const parsed = cartInputSchema.safeParse(await parseBody(request));
  if (!parsed.success) return json({ error: "invalid_cart" }, 400);
  const result = await services.cart.replace(parsed.data);
  return result.kind === "success" ? json({ cart: result.cart }, 200) : json({ error: result.kind }, 409);
};

export const createCheckoutRoute = (services: CommerceLocalServices) => async (request: Request): Promise<Response> => {
  const parsed = checkoutInputSchema.safeParse(await parseBody(request));
  if (!parsed.success) return json({ error: "invalid_checkout" }, 400);
  const result = await services.checkout.create(parsed.data);
  switch (result.kind) {
    case "created": return json({ order: result.order }, 201);
    case "conflict": return json({ error: "idempotency_conflict" }, 409);
    case "variant_not_found": return json({ error: "invalid_selection" }, 409);
  }
};

export const createOrderReadRoute = (services: CommerceLocalServices) => async (request: Request, orderId: string): Promise<Response> => {
  const owner = ownerFromHeader(request);
  if (!owner.success) return json({ error: "unauthorized" }, 401);
  const result = await services.orders.get({ owner: owner.data, orderId });
  return result.kind === "found" ? json({ order: result.order }, 200) : json({ error: "not_found" }, 404);
};
