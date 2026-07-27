import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { parseDeletionBegin, parseDeletionConfirmation } from "@/lib/account/security-schema";
import { privateJson, withPrivateErrorBoundary } from "../../private-response";

export const POST = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return privateJson({ error: "Unsupported media type" }, 415);
  let body: unknown;
  try { body = await request.json(); } catch { return privateJson({ error: "Invalid JSON" }, 400); }
  const begin = parseDeletionBegin(body);
  if (begin !== null) {
    const result = await getAccountSecurityPort().beginDeletion(account);
    return privateJson(result, result.kind === "recent_authentication_required" ? 409 : 200);
  }
  const confirmation = parseDeletionConfirmation(body);
  if (confirmation === null) return privateJson({ error: "Invalid deletion action" }, 422);
  const result = await getAccountSecurityPort().confirmDeletion(account, confirmation.confirmation);
  const status = result.kind === "recent_authentication_required" ? 409 : result.kind === "confirmation_mismatch" ? 422 : 200;
  return privateJson(result, status);
});
