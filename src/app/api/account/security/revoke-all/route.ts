import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { isEmptySecurityActionBody } from "@/lib/account/security-schema";
import { privateJson, withPrivateErrorBoundary } from "../../private-response";

export const POST = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  if (request.body !== null) {
    if (!request.headers.get("content-type")?.includes("application/json")) return privateJson({ error: "Unsupported media type" }, 415);
    try {
      if (!isEmptySecurityActionBody(await request.json())) return privateJson({ error: "Invalid action body" }, 422);
    } catch { return privateJson({ error: "Invalid JSON" }, 400); }
  }
  const result = await getAccountSecurityPort().revokeAllSessions(account);
  return privateJson(result, result.kind === "recent_authentication_required" ? 409 : 200);
});
