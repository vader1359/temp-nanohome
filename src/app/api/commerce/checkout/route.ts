import { retiredCommerceScaffoldResponse } from "@/lib/commerce/retired-route";

// Authenticated persisted-cart checkout lives at /api/checkout. The public
// order-request path remains /api/cart/submit until a durable ledger is wired.
export const POST = retiredCommerceScaffoldResponse;
