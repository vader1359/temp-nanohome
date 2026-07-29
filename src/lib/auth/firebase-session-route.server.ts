import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { safeAccountReturnTo } from "@/lib/account/auth-flow";
import {
  exchangeFirebaseIdToken,
  FirebaseSessionExchangeError,
  type FirebaseSessionIssuer,
} from "./firebase-session-exchange.server";
import { firebaseSessionCookieOptions, FIREBASE_SESSION_COOKIE } from "./firebase-session-verifier.server";

export const FIREBASE_CSRF_COOKIE = "__Host-nanohome-csrf";
const CSRF_TTL_SECONDS = 300;

const sessionRequestSchema = z.object({
  csrfToken: z.string().min(32).max(256),
  idToken: z.string().min(128).max(16_384),
  locale: z.enum(["vi", "en", "ko"]),
  returnTo: z.string().max(2_048),
}).strict();

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function csrfCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "strict" as const,
    secure: true,
  };
}

export type FirebaseSessionRouteDependencies = Readonly<{
  auth: FirebaseSessionIssuer;
  nowSeconds: () => number;
  projectId: string;
  sessionTtlSeconds: number;
  createCsrfToken?: () => string;
}>;

export function createFirebaseSessionRouteHandlers(dependencies: FirebaseSessionRouteDependencies) {
  return {
    GET: async (): Promise<NextResponse> => {
      const csrfToken = dependencies.createCsrfToken?.() ?? randomBytes(32).toString("base64url");
      const response = NextResponse.json({ csrfToken }, { headers: privateHeaders });
      response.cookies.set(FIREBASE_CSRF_COOKIE, csrfToken, csrfCookieOptions(CSRF_TTL_SECONDS));
      return response;
    },
    POST: async (request: NextRequest): Promise<NextResponse> => {
      if (!request.headers.get("content-type")?.includes("application/json")) {
        return NextResponse.json({ error: "Invalid request" }, { headers: privateHeaders, status: 415 });
      }

      let parsed: z.infer<typeof sessionRequestSchema>;
      try {
        parsed = sessionRequestSchema.parse(await request.json());
      } catch {
        return NextResponse.json({ error: "Invalid request" }, { headers: privateHeaders, status: 422 });
      }

      const csrfCookie = request.cookies.get(FIREBASE_CSRF_COOKIE)?.value;
      if (csrfCookie === undefined || !constantTimeEqual(csrfCookie, parsed.csrfToken)) {
        return NextResponse.json({ error: "Unauthorized" }, { headers: privateHeaders, status: 401 });
      }

      try {
        const result = await exchangeFirebaseIdToken({
          auth: dependencies.auth,
          idToken: parsed.idToken,
          nowSeconds: dependencies.nowSeconds(),
          projectId: dependencies.projectId,
          sessionTtlSeconds: dependencies.sessionTtlSeconds,
        });
        const response = NextResponse.json(
          { returnTo: safeAccountReturnTo(parsed.locale, parsed.returnTo) },
          { headers: privateHeaders },
        );
        response.cookies.set(
          FIREBASE_SESSION_COOKIE,
          result.sessionCookie,
          firebaseSessionCookieOptions(dependencies.sessionTtlSeconds),
        );
        response.cookies.set(FIREBASE_CSRF_COOKIE, "", csrfCookieOptions(0));
        return response;
      } catch (error) {
        const status = error instanceof FirebaseSessionExchangeError && error.code === "unverified_email" ? 403 : 401;
        return NextResponse.json({ error: "Unauthorized" }, { headers: privateHeaders, status });
      }
    },
  };
}
