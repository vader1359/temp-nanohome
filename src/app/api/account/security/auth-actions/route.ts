import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { parseSecurityAuthAction } from "@/lib/account/security-schema";
import { privateJson, withPrivateErrorBoundary } from "../../private-response";

async function parseJson(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try { return await request.json(); } catch { return null; }
}

export const POST = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  const input = parseSecurityAuthAction(await parseJson(request));
  if (input === null) return privateJson({ error: "Invalid auth action" }, 422);
  const result = await getAccountSecurityPort().requestAuthAction(account, input.action);
  return privateJson(result, result.kind === "recent_authentication_required" ? 409 : 200);
});
