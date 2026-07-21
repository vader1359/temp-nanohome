import { NextResponse } from "next/server";
import { consentRequestSchema } from "@/lib/consent/service";
import { customerIdentityCookieNames, customerTokens } from "@/lib/customer-context/identity";
import { createCustomerRepository } from "@/lib/customer-context/repository";

const requestCookies = (request: Request): Readonly<{ visitor?: string; session?: string }> => {
  const values = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return { visitor: values.get(customerIdentityCookieNames.visitor), session: values.get(customerIdentityCookieNames.session) };
};

export const POST = async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  if (origin === null || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origin required" }, { status: 403 });
  const tokens = customerTokens(requestCookies(request));
  if (tokens === null) return NextResponse.json({ error: "Identity required" }, { status: 401 });
  const identity = (await createCustomerRepository(fetch).resolveIdentity(tokens)).identity;
  if (identity === null) return NextResponse.json({ error: "Identity required" }, { status: 401 });
  let input: unknown;
  try {
    input = await request.json();
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid JSON" : "Request body unavailable" }, { status: 400 });
  }
  const parsed = consentRequestSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent", issues: parsed.error.issues.map((issue) => issue.path.join(".")) }, { status: 400 });
  const consent = await createCustomerRepository(fetch).appendConsent(identity, { ...parsed.data, essential: true });
  if (consent === null) return NextResponse.json({ error: "Consent persistence unavailable" }, { status: 503 });
  return NextResponse.json({
    locale: parsed.data.locale ?? "vi",
    consent: { analytics: consent.analytics, personalization: consent.personalization, aiProcessing: consent.aiProcessing ?? false, aiConversationStorage: consent.aiConversationStorage ?? false, roomImageProcessing: consent.roomImageProcessing ?? false, roomImageStorage: consent.roomImageStorage ?? false, version: consent.version ?? "" },
    capabilities: {
      analyticsTracking: consent.analytics === true && consent.withdrawn !== true,
      marketingTracking: consent.marketing === true && consent.withdrawn !== true,
    },
  });
};
