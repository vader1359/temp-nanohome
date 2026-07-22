import { retiredCommerceScaffoldResponse } from "@/lib/commerce/retired-route";

// The customer cart remains local and order requests use /api/cart/submit.
// Do not expose the Plan 02 in-memory scaffold as a production cart API.
export const POST = retiredCommerceScaffoldResponse;
