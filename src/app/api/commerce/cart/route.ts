import { cartInputSchema } from "@/lib/commerce/commerce-local";
import { createCommerceRouteComposition } from "@/lib/commerce/route-composition";
import type { ServerOwnedCommerceRoutes } from "@/lib/commerce/server-owned-routes";

const requestSchema = cartInputSchema;

const response = (body: Readonly<Record<string, unknown>>, status: number): Response => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store" },
});

const parseBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
};

export const createPostHandler = (routes: ServerOwnedCommerceRoutes) => async (request: Request): Promise<Response> => {
  const parsed = requestSchema.safeParse(await parseBody(request));
  if (!parsed.success) return response({ error: "invalid_cart" }, 400);
  const result = await routes.replaceCart(parsed.data);
  switch (result.kind) {
    case "unauthorized": return response({ error: result.kind }, 401);
    case "variant_not_found": return response({ error: "invalid_selection" }, 409);
    case "success": return response({ cart: result.cart }, 200);
  }
};

const composition = createCommerceRouteComposition();
export const POST = createPostHandler(composition.routes);
