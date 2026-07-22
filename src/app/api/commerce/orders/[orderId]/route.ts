import { createCommerceRouteComposition } from "@/lib/commerce/route-composition";

import { createGetHandler } from "./handler";

const composition = createCommerceRouteComposition();

export const GET = createGetHandler(composition.routes);
