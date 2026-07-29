import { getAccountAuthPort, getAccountCartPort } from "@/lib/account/account-ports.server";
import { parseCartMutation, parseCartRemoval } from "@/lib/account/cart-schema";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { privateJson, withPrivateErrorBoundary } from "../private-response";

async function parseRequest(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try { return await request.json(); } catch (error: unknown) { if (error instanceof SyntaxError) return null; throw error; }
}
function resultJson(result: Awaited<ReturnType<ReturnType<typeof getAccountCartPort>["addItem"]>>): Response {
  if (result.status === "version_conflict") {
    return privateJson({ cart: result.cart, error: "version_conflict" }, 409);
  }
  if (result.status === "unavailable") {
    return privateJson({ cart: result.cart, error: "variant_unavailable" }, 422);
  }
  return privateJson({ cart: result.cart }, 200);
}
export const GET = withPrivateErrorBoundary(async (): Promise<Response> => {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  return privateJson({ cart: await getAccountCartPort().getCart(account) }, 200);
});
export const POST = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  if (!isSameOriginPost(request)) return privateJson({ error: "Forbidden" }, 403);
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseCartMutation(await parseRequest(request));
  if (input === null) return privateJson({ error: "A valid cart mutation is required" }, 422);
  return resultJson(await getAccountCartPort().addItem(account, input));
});
export const PATCH = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  if (!isSameOriginPost(request)) return privateJson({ error: "Forbidden" }, 403);
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseCartMutation(await parseRequest(request));
  if (input === null) return privateJson({ error: "A valid cart mutation is required" }, 422);
  return resultJson(await getAccountCartPort().updateItem(account, input));
});
export const DELETE = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  if (!isSameOriginPost(request)) return privateJson({ error: "Forbidden" }, 403);
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseCartRemoval(await parseRequest(request));
  if (input === null) return privateJson({ error: "A valid cart removal is required" }, 422);
  return resultJson(await getAccountCartPort().removeItem(account, input));
});
