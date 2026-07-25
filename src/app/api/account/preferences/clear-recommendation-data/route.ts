import { getAccountAuthPort, getAccountPreferencesPort } from "@/lib/account/account-ports.server";
import { isEmptyPreferencesActionBody } from "@/lib/account/preferences-schema";
import { privateJson, withPrivateErrorBoundary } from "../../private-response";

export const POST = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
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

  const preferences = await getAccountPreferencesPort().clearRecommendationData(account);
  return privateJson(preferences);
});
