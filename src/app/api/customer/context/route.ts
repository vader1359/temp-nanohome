import { NextResponse } from "next/server";
import type { ClientCustomerContext } from "@/lib/contracts/schemas";
import { customerIdentityCookieNames, customerTokens, issueCustomerIdentity } from "@/lib/customer-context/identity";
import { createCustomerRepository } from "@/lib/customer-context/repository";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

const json = (body: unknown, status = 200): NextResponse => NextResponse.json(body, {
  status,
  headers: responseHeaders,
});

const requestCookies = (request: Request): Readonly<{ visitor?: string; session?: string }> => {
  const values = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return { visitor: values.get(customerIdentityCookieNames.visitor), session: values.get(customerIdentityCookieNames.session) };
};

function hasSupabaseAuthCookie(request: Request): boolean {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .some((cookie) => {
      const name = cookie.trim().split("=", 1)[0] ?? "";
      return name.startsWith("sb-") && name.includes("auth-token");
    });
}

export const GET = async (request: Request): Promise<Response> => {
  const repository = createCustomerRepository(fetch);
  const tokens = customerTokens(requestCookies(request));
  const lookup = tokens === null ? { identity: null, status: "missing" as const } : await repository.resolveIdentity(tokens);
  const existing = lookup.identity;
  const issued = existing === null ? issueCustomerIdentity() : null;
  const bootstrapped = issued === null ? null : await repository.bootstrapIdentity({ visitor: issued.visitorId, session: issued.sessionId });
  const identity = existing ?? bootstrapped?.identity;
  if (identity === null || identity === undefined) return json({ error: "Identity unavailable" }, 503);
  let verifiedUserId: string | null = null;
  if (hasSupabaseAuthCookie(request)) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error === null && data.user !== null) verifiedUserId = data.user.id;
    } catch {
      return json({ error: "Authentication unavailable" }, 503);
    }
  }
  const binding = verifiedUserId === null
    ? await repository.clearVerifiedUser(identity)
    : await repository.bindVerifiedUser(identity, verifiedUserId);
  if (binding === null) return json({ error: "Identity binding unavailable" }, 503);
  const consent = await repository.currentConsent(identity);
  const body: ClientCustomerContext = {
    locale: "vi",
    consent: { analytics: consent?.analytics ?? false, personalization: consent?.personalization ?? false, aiProcessing: consent?.aiProcessing ?? false, aiConversationStorage: consent?.aiConversationStorage ?? false, roomImageProcessing: consent?.roomImageProcessing ?? false, roomImageStorage: consent?.roomImageStorage ?? false, version: consent?.version ?? "none" },
    capabilities: {
      analyticsTracking: consent?.analytics === true && consent.withdrawn !== true,
      marketingTracking: consent?.marketing === true && consent.withdrawn !== true,
    },
  };
  const response = json(body);
  if (lookup.status === "inactive") {
    response.cookies.set(customerIdentityCookieNames.visitor, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    response.cookies.set(customerIdentityCookieNames.session, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  }
  for (const cookie of issued?.cookies ?? []) response.cookies.set(cookie.name, cookie.value, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  if (issued !== null) {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie !== null) response.headers.set("set-cookie", setCookie.replaceAll("SameSite=lax", "SameSite=Lax"));
  }
  return response;
};
