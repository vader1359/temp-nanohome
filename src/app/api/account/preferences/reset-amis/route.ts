import { getAccountAuthPort, getAccountPreferencesPort } from "@/lib/account/account-ports.server";
import { isEmptyPreferencesActionBody } from "@/lib/account/preferences-schema";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function POST(request: Request) {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return Response.json({ error: "Authentication required" }, { headers: privateHeaders, status: 401 });
  if (request.body !== null) {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "Unsupported media type" }, { headers: privateHeaders, status: 415 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { headers: privateHeaders, status: 400 });
    }
    if (!isEmptyPreferencesActionBody(body)) {
      return Response.json({ error: "Invalid action body" }, { headers: privateHeaders, status: 422 });
    }
  }

  const result = await getAccountPreferencesPort().resetAmisHistory(account);
  if (result.kind === "recent_authentication_required") {
    return Response.json(result, { headers: privateHeaders, status: 409 });
  }

  return Response.json(result.preferences, { headers: privateHeaders });
}
