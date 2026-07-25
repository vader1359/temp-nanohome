import { getAccountAuthPort, getAccountPreferencesPort } from "@/lib/account/account-ports.server";
import { parseAccountPreferencesPatch } from "@/lib/account/preferences-schema";
import { privateJson, withPrivateErrorBoundary } from "../private-response";

export const GET = withPrivateErrorBoundary(async (): Promise<Response> => {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return privateJson({ error: "Authentication required" }, 401);

  return privateJson(await getAccountPreferencesPort().getPreferences(account), 200);
});

export const PATCH = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
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
});
