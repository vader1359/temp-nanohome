import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createEmailLinkRecoveryTransaction,
  EMAIL_LINK_RECOVERY_COOKIE,
  EMAIL_LINK_RECOVERY_COOKIE_MAX_AGE_SECONDS,
  inspectEmailLinkRecoveryTransaction,
  recoveryMetadataForIdentity,
} from "./email-link-recovery-transaction.server";
import type { EmailLinkRecoveryLedger } from "./email-link-recovery-ledger.server";
import { normalizeEmail } from "./email-normalization";
import { isSameOriginPost } from "./same-origin.server";
import { safeAccountReturnTo } from "@/lib/account/auth-flow";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

const startSchema = z.object({
  email: z.string().min(1).max(320),
  idToken: z.string().min(1).max(16_384),
  intent: z.enum(["account", "checkout"]).default("account"),
  locale: z.enum(["vi", "en", "ko"]),
  returnTo: z.string().max(2_048).optional(),
}).strict();

const consumeSchema = z.object({
  idToken: z.string().min(1).max(16_384),
  state: z.string().min(1).max(128),
}).strict();

type RecoveryTokenVerifier = Readonly<{
  verifyIdToken: (idToken: string, checkRevoked: boolean) => Promise<DecodedIdToken>;
}>;

export type EmailLinkRecoveryRouteDependencies = Readonly<{
  auth: RecoveryTokenVerifier;
  ledger: EmailLinkRecoveryLedger;
  nowSeconds: () => number;
  secret: string;
  stateFactory?: () => string;
}>;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { headers: privateHeaders, status });
}

function clearRecoveryCookie(response: NextResponse): NextResponse {
  response.cookies.set(EMAIL_LINK_RECOVERY_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  return response;
}

function hasRecentAuthentication(decoded: DecodedIdToken, nowSeconds: number): boolean {
  return typeof decoded.auth_time === "number"
    && decoded.auth_time <= nowSeconds + 30
    && nowSeconds - decoded.auth_time <= 300;
}

async function decodedToken(auth: RecoveryTokenVerifier, idToken: string): Promise<DecodedIdToken | null> {
  try {
    const decoded = await auth.verifyIdToken(idToken, true);
    return typeof decoded.uid === "string" && decoded.uid.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

function inspect(request: NextRequest, dependencies: EmailLinkRecoveryRouteDependencies, state: string) {
  return inspectEmailLinkRecoveryTransaction({
    cookieValue: request.cookies.get(EMAIL_LINK_RECOVERY_COOKIE)?.value,
    nowSeconds: dependencies.nowSeconds(),
    secret: dependencies.secret,
    state,
  });
}

function inspectionError(status: "expired" | "invalid" | "replayed"): NextResponse {
  const error = status === "expired"
    ? "recovery_expired"
    : status === "replayed"
      ? "recovery_replayed"
      : "recovery_invalid";
  const httpStatus = status === "expired" ? 410 : status === "replayed" ? 409 : 400;
  return clearRecoveryCookie(json(
    { error },
    httpStatus,
  ));
}

function unavailable(): NextResponse {
  return json({ error: "recovery_unavailable" }, 503);
}

export function createEmailLinkRecoveryRouteHandlers(dependencies: EmailLinkRecoveryRouteDependencies) {
  return {
    async GET(request: NextRequest): Promise<NextResponse> {
      const state = request.nextUrl.searchParams.get("state") ?? "";
      const result = inspect(request, dependencies, state);
      if (result.status !== "valid") return inspectionError(result.status);
      try {
        const ledgerStatus = await dependencies.ledger.inspect(result.payload.stateDigest);
        return ledgerStatus === "valid" ? json({ valid: true }) : inspectionError(ledgerStatus);
      } catch {
        return unavailable();
      }
    },

    async POST(request: NextRequest): Promise<NextResponse> {
      if (!isSameOriginPost(request)) return json({ error: "forbidden" }, 403);

      let input: unknown;
      try {
        input = await request.json();
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      const parsed = startSchema.safeParse(input);
      if (!parsed.success) return json({ error: "invalid_request" }, 400);
      const email = normalizeEmail(parsed.data.email);
      if (email === null) return json({ error: "invalid_request" }, 400);

      const nowSeconds = dependencies.nowSeconds();
      const decoded = await decodedToken(dependencies.auth, parsed.data.idToken);
      if (decoded === null) return json({ error: "invalid_token" }, 401);
      if (!hasRecentAuthentication(decoded, nowSeconds)) {
        return json({ error: "recent_sign_in_required" }, 403);
      }

      const transaction = createEmailLinkRecoveryTransaction({
        email,
        intent: parsed.data.intent,
        locale: parsed.data.locale,
        nowSeconds,
        returnTo: safeAccountReturnTo(parsed.data.locale, parsed.data.returnTo),
        secret: dependencies.secret,
        state: dependencies.stateFactory?.(),
        uid: decoded.uid,
      });
      try {
        const started = await dependencies.ledger.begin({
          expiresAt: transaction.expiresAt,
          stateDigest: transaction.stateDigest,
        });
        if (!started) return unavailable();
      } catch {
        return unavailable();
      }
      const response = json({ state: transaction.state }, 201);
      response.cookies.set(EMAIL_LINK_RECOVERY_COOKIE, transaction.cookieValue, {
        httpOnly: true,
        maxAge: EMAIL_LINK_RECOVERY_COOKIE_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: true,
      });
      return response;
    },

    async PUT(request: NextRequest): Promise<NextResponse> {
      if (!isSameOriginPost(request)) return json({ error: "forbidden" }, 403);

      let input: unknown;
      try {
        input = await request.json();
      } catch {
        return json({ error: "invalid_request" }, 400);
      }
      const parsed = consumeSchema.safeParse(input);
      if (!parsed.success) return json({ error: "invalid_request" }, 400);

      const transaction = inspect(request, dependencies, parsed.data.state);
      if (transaction.status !== "valid") return inspectionError(transaction.status);

      const nowSeconds = dependencies.nowSeconds();
      const decoded = await decodedToken(dependencies.auth, parsed.data.idToken);
      if (decoded === null) return json({ error: "invalid_token" }, 401);
      if (!hasRecentAuthentication(decoded, nowSeconds)) {
        return json({ error: "recent_sign_in_required" }, 403);
      }

      const metadata = recoveryMetadataForIdentity({
        email: decoded.email,
        emailVerified: decoded.email_verified === true,
        inspection: transaction,
        secret: dependencies.secret,
        uid: decoded.uid,
      });
      if (metadata === null) {
        return json({ error: "recovery_identity_mismatch" }, 409);
      }

      try {
        const ledgerStatus = await dependencies.ledger.consume(transaction.payload.stateDigest);
        if (ledgerStatus !== "consumed") return inspectionError(ledgerStatus);
      } catch {
        return unavailable();
      }

      return clearRecoveryCookie(json(metadata));
    },
  };
}
