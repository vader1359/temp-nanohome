import { getAccountAuthPort, getAccountProfilePort } from "@/lib/account/account-ports.server";
import { parseProfilePatch } from "@/lib/account/profile-schema";
import { privateJson, withPrivateErrorBoundary } from "../private-response";

async function getAuthenticatedAccount() {
  return getAccountAuthPort().getAuthenticatedAccount();
}

export const GET = withPrivateErrorBoundary(async (): Promise<Response> => {
  const account = await getAuthenticatedAccount();
  if (account === null) {
    return privateJson({ error: "Authentication required" }, 401);
  }

  const profile = await getAccountProfilePort().getProfile(account);
  return privateJson(profile);
});

export const PATCH = withPrivateErrorBoundary(async (request: Request): Promise<Response> => {
  const account = await getAuthenticatedAccount();
  if (account === null) {
    return privateJson({ error: "Authentication required" }, 401);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return privateJson({ error: "Content-Type must be application/json" }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return privateJson({ error: "Malformed JSON" }, 400);
    }
    throw error;
  }

  const parsed = parseProfilePatch(body);
  if (!parsed.ok) {
    return privateJson(
      { fieldErrors: parsed.fieldErrors, submitted: parsed.submitted },
      422,
    );
  }

  const profile = await getAccountProfilePort().patchProfile(account, parsed.value);
  return privateJson(profile);
});
