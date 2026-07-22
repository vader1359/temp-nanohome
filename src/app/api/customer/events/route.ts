import { NextResponse } from "next/server";
import { customerIdentityCookieNames, customerTokens } from "@/lib/customer-context/identity";
import { createCustomerRepository } from "@/lib/customer-context/repository";
import { hasEventConsent, parseCustomerEvent } from "@/lib/events/service";

export const dynamic = "force-dynamic";

const MAX_EVENT_BYTES = 4_096;
const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Origin",
} as const;

const json = (body: unknown, status = 200, headers?: HeadersInit): NextResponse => NextResponse.json(body, {
  status,
  headers: { ...responseHeaders, ...headers },
});

const requestCookies = (request: Request): Readonly<{ visitor?: string; session?: string }> => {
  const values = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) values.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return {
    visitor: values.get(customerIdentityCookieNames.visitor),
    session: values.get(customerIdentityCookieNames.session),
  };
};

type JsonReadResult =
  | Readonly<{ kind: "ok"; value: unknown }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "too_large" }>
  | Readonly<{ kind: "unsupported" }>;

const readJson = async (request: Request): Promise<JsonReadResult> => {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return { kind: "unsupported" };
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EVENT_BYTES) return { kind: "too_large" };
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_EVENT_BYTES) return { kind: "too_large" };
    return { kind: "ok", value: JSON.parse(body) as unknown };
  } catch {
    return { kind: "invalid" };
  }
};

export const POST = async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  if (origin === null || origin !== new URL(request.url).origin) return json({ error: "Origin required" }, 403);

  const input = await readJson(request);
  if (input.kind === "unsupported") return json({ error: "JSON required" }, 415);
  if (input.kind === "too_large") return json({ error: "Event too large" }, 413);
  if (input.kind === "invalid") return json({ error: "Invalid JSON" }, 400);
  const event = parseCustomerEvent(input.value);
  if (!event.success) return json({ error: "Invalid event" }, 400);

  const tokens = customerTokens(requestCookies(request));
  if (tokens === null) return json({ error: "Identity required" }, 401);
  const repository = createCustomerRepository(fetch);
  const identity = (await repository.resolveIdentity(tokens)).identity;
  if (identity === null) return json({ error: "Identity required" }, 401);

  const consent = await repository.currentConsent(identity);
  if (consent === null || !hasEventConsent(consent, event.data.name)) {
    return json({ error: "Consent required" }, 403);
  }

  const result = await repository.appendEvent(identity, event.data, new Date().toISOString());
  if (result === "accepted") return json({ status: "accepted" }, 202);
  if (result === "duplicate") return json({ status: "duplicate" });
  if (result === "rate_limited") return json({ error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });
  return json({ error: "Event persistence unavailable" }, 503);
};
