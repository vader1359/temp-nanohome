import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { parseDeletionBegin, parseDeletionConfirmation } from "@/lib/account/security-schema";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function POST(request: Request) {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "Authentication required" }, { headers: privateHeaders, status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Unsupported media type" }, { headers: privateHeaders, status: 415 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { headers: privateHeaders, status: 400 }); }
  const begin = parseDeletionBegin(body);
  if (begin !== null) {
    const result = await getAccountSecurityPort().beginDeletion(account);
    return Response.json(result, { headers: privateHeaders, status: result.kind === "recent_authentication_required" ? 409 : 200 });
  }
  const confirmation = parseDeletionConfirmation(body);
  if (confirmation === null) return Response.json({ error: "Invalid deletion action" }, { headers: privateHeaders, status: 422 });
  const result = await getAccountSecurityPort().confirmDeletion(account, confirmation.confirmation);
  const status = result.kind === "recent_authentication_required" ? 409 : result.kind === "confirmation_mismatch" ? 422 : 200;
  return Response.json(result, { headers: privateHeaders, status });
}
