import { getAccountAuthPort, getAccountCartPort } from "@/lib/account/account-ports.server";
import { parseGuestCartMerge } from "@/lib/account/cart-schema";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { privateJson, withPrivateErrorBoundary } from "../../private-response";

async function parseRequest(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try { return await request.json(); } catch (error: unknown) { if (error instanceof SyntaxError) return null; throw error; }
}
export const POST = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  if (!isSameOriginPost(request)) return privateJson({ error: "Forbidden" }, 403);
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseGuestCartMerge(await parseRequest(request));
  if (input === null) return privateJson({ error: "A valid guest cart merge is required" }, 422);
  return privateJson({ cart: await getAccountCartPort().mergeGuestCart(account, input) }, 200);
});
