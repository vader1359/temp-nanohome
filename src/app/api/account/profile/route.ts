import { NextResponse } from "next/server";

import { getAccountAuthPort, getAccountProfilePort } from "@/lib/account/account-ports.server";
import { parseProfilePatch } from "@/lib/account/profile-schema";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

function privateJson(body: unknown, init: Readonly<{ readonly status: number }>): NextResponse {
  return NextResponse.json(body, { ...init, headers: privateHeaders });
}

async function getAuthenticatedAccount() {
  return getAccountAuthPort().getAuthenticatedAccount();
}

export async function GET(): Promise<NextResponse> {
  const account = await getAuthenticatedAccount();
  if (account === null) {
    return privateJson({ error: "Authentication required" }, { status: 401 });
  }

  const profile = await getAccountProfilePort().getProfile(account);
  return privateJson(profile, { status: 200 });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const account = await getAuthenticatedAccount();
  if (account === null) {
    return privateJson({ error: "Authentication required" }, { status: 401 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return privateJson({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return privateJson({ error: "Malformed JSON" }, { status: 400 });
    }
    throw error;
  }

  const parsed = parseProfilePatch(body);
  if (!parsed.ok) {
    return privateJson(
      { fieldErrors: parsed.fieldErrors, submitted: parsed.submitted },
      { status: 422 },
    );
  }

  const profile = await getAccountProfilePort().patchProfile(account, parsed.value);
  return privateJson(profile, { status: 200 });
}
