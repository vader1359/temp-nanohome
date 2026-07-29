import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createFirebaseAdminAuth } from "./firebase-admin.server";
import {
  exchangeFirebaseIdToken,
  FIREBASE_ALLOWED_SIGN_IN_PROVIDERS,
} from "./firebase-session-exchange.server";
import {
  firebaseSessionCookieOptions,
  FIREBASE_SESSION_COOKIE,
} from "./firebase-session-verifier.server";

function runtime() {
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
  if (projectId === undefined) throw new Error("Firebase Admin project is unavailable");
  return {
    auth: createFirebaseAdminAuth({
      projectId,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
    projectId,
    sessionTtlSeconds: env.AUTH_SESSION_TTL_SECONDS ?? 432_000,
  };
}

export async function issueFirebaseSessionCookie(idToken: string): Promise<Readonly<{
  readonly value: string;
  readonly maxAge: number;
}>> {
  const current = runtime();
  const result = await exchangeFirebaseIdToken({
    auth: current.auth,
    idToken,
    nowSeconds: Math.floor(Date.now() / 1_000),
    projectId: current.projectId,
    sessionTtlSeconds: current.sessionTtlSeconds,
  });
  return { maxAge: current.sessionTtlSeconds, value: result.sessionCookie };
}

export function applyFirebaseSessionCookie(
  response: NextResponse,
  session: Readonly<{ readonly value: string; readonly maxAge: number }>,
): NextResponse {
  response.cookies.set(
    FIREBASE_SESSION_COOKIE,
    session.value,
    firebaseSessionCookieOptions(session.maxAge),
  );
  return response;
}

export function clearFirebaseSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(FIREBASE_SESSION_COOKIE, "", {
    ...firebaseSessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}

export async function getCurrentFirebaseSessionClaims(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  if (value === undefined || value === "") return null;

  try {
    const current = runtime();
    const decoded = await current.auth.verifySessionCookie(value, true);
    const provider = decoded.firebase?.sign_in_provider;
    const validProvider = FIREBASE_ALLOWED_SIGN_IN_PROVIDERS.includes(
      provider as (typeof FIREBASE_ALLOWED_SIGN_IN_PROVIDERS)[number],
    );
    const claimsMatch = decoded.aud === current.projectId
      && decoded.iss === `https://session.firebase.google.com/${current.projectId}`
      && decoded.sub.length > 0
      && decoded.sub === decoded.uid
      && validProvider;
    return claimsMatch ? decoded : null;
  } catch {
    return null;
  }
}
