import { getAccountAuthPort, getAccountWishlistPort } from "@/lib/account/account-ports.server";
import { parseGuestWishlistMerge } from "@/lib/account/wishlist-schema";
import { privateJson, withPrivateErrorBoundary } from "../private-response";

export const POST = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return privateJson({ error: "Content-Type must be application/json" }, 415);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return privateJson({ error: "Malformed JSON" }, 400);
    throw error;
  }
  const input = parseGuestWishlistMerge(body);
  if (input === null) return privateJson({ error: "A bounded canonical guest wishlist is required" }, 422);
  const items = await getAccountWishlistPort().mergeGuestItems(account, input);
  return privateJson({ items }, 200);
});
