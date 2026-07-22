import { createCommerceRouteComposition } from "@/lib/commerce/route-composition";

import { createPostHandler } from "./handler";

const composition = createCommerceRouteComposition();

export const POST = createPostHandler(composition.routes);
