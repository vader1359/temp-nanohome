import { getAccountAuthPort, getAccountSecurityPort } from "@/lib/account/account-ports.server";
import { isEmptySecurityActionBody } from "@/lib/account/security-schema";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function POST(request?: Request) {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "Authentication required" }, { headers: privateHeaders, status: 401 });
  if (request?.body !== null && request !== undefined) {
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Unsupported media type" }, { headers: privateHeaders, status: 415 });
    try {
      if (!isEmptySecurityActionBody(await request.json())) return Response.json({ error: "Invalid action body" }, { headers: privateHeaders, status: 422 });
    } catch { return Response.json({ error: "Invalid JSON" }, { headers: privateHeaders, status: 400 }); }
  }
  return Response.json(await getAccountSecurityPort().logoutCurrentSession(account), { headers: privateHeaders });
}
