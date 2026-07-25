import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { parseSecurityAuthAction } from "@/lib/account/security-schema";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

async function parseJson(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  try { return await request.json(); } catch { return null; }
}

export async function POST(request: Request) {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "Authentication required" }, { headers: privateHeaders, status: 401 });
  const input = parseSecurityAuthAction(await parseJson(request));
  if (input === null) return Response.json({ error: "Invalid auth action" }, { headers: privateHeaders, status: 422 });
  const result = await getAccountSecurityPort().requestAuthAction(account, input.action);
  return Response.json(result, { headers: privateHeaders, status: result.kind === "recent_authentication_required" ? 409 : 200 });
}
