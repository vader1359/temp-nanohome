import { getAccountAuthPort, getAccountPreferencesPort } from "@/lib/account/account-ports.server";
import { parseAccountPreferencesPatch } from "@/lib/account/preferences-schema";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

function privateJson(body: unknown, status: number) {
  return Response.json(body, { headers: privateHeaders, status });
}

export async function GET() {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);

  return privateJson(await getAccountPreferencesPort().getPreferences(account), 200);
}

export async function PATCH(request: Request) {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return privateJson({ error: "Unsupported media type" }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON" }, 400);
  }

  const patch = parseAccountPreferencesPatch(body);
  if (patch === null) return privateJson({ error: "Invalid preferences patch" }, 422);

  return privateJson(await getAccountPreferencesPort().updatePreferences(account, patch), 200);
}
