import { retiredCommerceScaffoldResponse } from "@/lib/commerce/retired-route";

// The Plan 02 repository is process-local and must not be presented as durable
// order history. A persisted owner-protected read route is future work.
export const GET = retiredCommerceScaffoldResponse;
