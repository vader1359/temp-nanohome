import { getAccountAuthPort, getAccountPreferencesPort } from "@/lib/account/account-ports.server";
import { isEmptyPreferencesActionBody } from "@/lib/account/preferences-schema";
import { isSameOriginPost } from "@/lib/auth/same-origin.server";
import { privateJson, withPrivateErrorBoundary } from "../../private-response";

export const POST = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  if (!isSameOriginPost(request)) return privateJson({ error: "Forbidden" }, 403);
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  if (request.body !== null) {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return privateJson({ error: "Unsupported media type" }, 415);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return privateJson({ error: "Invalid JSON" }, 400);
    }
    if (!isEmptyPreferencesActionBody(body)) {
      return privateJson({ error: "Invalid action body" }, 422);
    }
  }

  const result = await getAccountPreferencesPort().resetAmisHistory(account);
  if (result.kind === "recent_authentication_required") {
    return privateJson(result, 409);
  }

  return privateJson(result.preferences);
});
