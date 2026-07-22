import { createCommerceRouteComposition } from "@/lib/commerce/route-composition";
import type { ServerOwnedCommerceRoutes } from "@/lib/commerce/server-owned-routes";

type RouteContext = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

const response = (body: Readonly<Record<string, unknown>>, status: number): Response => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export const createGetHandler = (routes: ServerOwnedCommerceRoutes) => async (request: Request, context: RouteContext): Promise<Response> => {
  const { orderId } = await context.params;
  const result = await routes.getOrder(orderId);
  switch (result.kind) {
    case "unauthorized": return response({ error: result.kind }, 401);
    case "not_found": return response({ error: result.kind }, 404);
    case "found": return response({ order: result.order }, 200);
  }
};

const composition = createCommerceRouteComposition();
export const GET = createGetHandler(composition.routes);
