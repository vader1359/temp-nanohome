import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmailLinkRecoveryRouteHandlers,
  type EmailLinkRecoveryRouteDependencies,
} from "./email-link-recovery-route.server";
import type {
  EmailLinkRecoveryLedger,
  EmailLinkRecoveryLedgerInspection,
} from "./email-link-recovery-ledger.server";
import { EMAIL_LINK_RECOVERY_COOKIE } from "./email-link-recovery-transaction.server";

const nowSeconds = 2_000_000_000;
const recoveryState = "s".repeat(43);
const secret = "email-link-recovery-test-secret-at-least-32-bytes";

function token(overrides: Partial<DecodedIdToken> = {}): DecodedIdToken {
  return {
    aud: "temp-nanohome",
    auth_time: nowSeconds - 10,
    exp: nowSeconds + 3_600,
    firebase: { identities: {}, sign_in_provider: "phone" },
    iat: nowSeconds - 10,
    iss: "https://securetoken.google.com/temp-nanohome",
    sub: "firebase-user-01",
    uid: "firebase-user-01",
    ...overrides,
  } as DecodedIdToken;
}

function request(path: string, init: RequestInit = {}): NextRequest {
  const headers = new Headers(init.headers);
  headers.set("Origin", "https://staging.nanohome.vn");
  return new NextRequest(`https://staging.nanohome.vn${path}`, {
    body: init.body,
    headers,
    method: init.method,
  });
}

describe("email-link recovery route", () => {
  let currentTime: number;
  let ledger: EmailLinkRecoveryLedger;
  let ledgerState: EmailLinkRecoveryLedgerInspection;
  let verifyIdToken: ReturnType<typeof vi.fn>;
  let dependencies: EmailLinkRecoveryRouteDependencies;

  beforeEach(() => {
    currentTime = nowSeconds;
    ledgerState = "invalid";
    ledger = {
      begin: vi.fn(async () => {
        if (ledgerState !== "invalid") return false;
        ledgerState = "valid";
        return true;
      }),
      consume: vi.fn(async () => {
        if (ledgerState === "valid") {
          ledgerState = "replayed";
          return "consumed" as const;
        }
        return ledgerState === "expired" ? "expired" as const : "replayed" as const;
      }),
      inspect: vi.fn(async () => ledgerState),
    };
    verifyIdToken = vi.fn(async () => token());
    dependencies = {
      auth: { verifyIdToken },
      ledger,
      nowSeconds: () => currentTime,
      secret,
      stateFactory: () => recoveryState,
    };
  });

  async function start(returnTo = "/vi/checkout?auth=login") {
    return createEmailLinkRecoveryRouteHandlers(dependencies).POST(request("/api/auth/email-link/recovery", {
      body: JSON.stringify({
        email: "Verified@Example.Test ",
        idToken: "start-id-token",
        intent: "checkout",
        locale: "vi",
        returnTo,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));
  }

  it("starts an HttpOnly transaction with opaque JSON state and no raw identity in its cookie payload", async () => {
    const response = await start();

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ state: recoveryState });
    const cookie = response.cookies.get(EMAIL_LINK_RECOVERY_COOKIE)?.value;
    expect(cookie).toBeDefined();
    const encodedPayload = cookie?.split(".")[0] ?? "";
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    expect(Object.keys(payload).sort()).toEqual([
      "emailDigest",
      "expiresAt",
      "intent",
      "issuedAt",
      "locale",
      "returnTo",
      "stateDigest",
      "uidDigest",
      "version",
    ]);
    expect(JSON.stringify(payload)).not.toContain("Verified@Example.Test");
    expect(JSON.stringify(payload)).not.toContain("firebase-user-01");
    expect(cookie).not.toContain("Verified@Example.Test");
    expect(cookie).not.toContain("firebase-user-01");
    expect(cookie).not.toContain("checkout");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(ledger.begin).toHaveBeenCalledWith({
      expiresAt: nowSeconds + 600,
      stateDigest: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
    });
    expect(vi.mocked(ledger.begin).mock.calls[0]?.[0].stateDigest).not.toBe(recoveryState);
  });

  it("fails before issuing a recovery cookie when the durable ledger is unavailable", async () => {
    vi.mocked(ledger.begin).mockRejectedValueOnce(new Error("offline"));

    const response = await start();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "recovery_unavailable" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns only server-sanitized metadata after matching UID and verified email", async () => {
    const startResponse = await start("https://evil.example/steal");
    const cookie = startResponse.cookies.get(EMAIL_LINK_RECOVERY_COOKIE)?.value;
    verifyIdToken.mockResolvedValueOnce(token({
      email: "verified@example.test",
      email_verified: true,
    }));

    const response = await createEmailLinkRecoveryRouteHandlers(dependencies).PUT(request("/api/auth/email-link/recovery", {
      body: JSON.stringify({ idToken: "fresh-id-token", state: recoveryState }),
      headers: {
        "content-type": "application/json",
        cookie: `${EMAIL_LINK_RECOVERY_COOKIE}=${cookie}`,
      },
      method: "PUT",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ intent: "checkout", locale: "vi", returnTo: "/vi" });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(verifyIdToken).toHaveBeenLastCalledWith("fresh-id-token", true);
  });

  it("fails closed for missing, tampered, and expired state", async () => {
    const handlers = createEmailLinkRecoveryRouteHandlers(dependencies);
    const missing = await handlers.GET(request("/api/auth/email-link/recovery"));
    expect(missing.status).toBe(400);
    const malformed = await handlers.GET(request("/api/auth/email-link/recovery?state=short"));
    expect(malformed.status).toBe(400);

    const startResponse = await start();
    const cookie = startResponse.cookies.get(EMAIL_LINK_RECOVERY_COOKIE)?.value;
    const tampered = await handlers.GET(request(`/api/auth/email-link/recovery?state=${"x".repeat(43)}`, {
      headers: { cookie: `${EMAIL_LINK_RECOVERY_COOKIE}=${cookie}` },
    }));
    expect(tampered.status).toBe(400);

    currentTime += 601;
    const expired = await handlers.GET(request(`/api/auth/email-link/recovery?state=${recoveryState}`, {
      headers: { cookie: `${EMAIL_LINK_RECOVERY_COOKIE}=${cookie}` },
    }));
    expect(expired.status).toBe(410);
    await expect(expired.json()).resolves.toEqual({ error: "recovery_expired" });
  });

  it("removes auth drawer noise from an internal checkout destination", async () => {
    const startResponse = await start("/vi/checkout?step=contact&auth=login");
    const cookie = startResponse.cookies.get(EMAIL_LINK_RECOVERY_COOKIE)?.value;
    verifyIdToken.mockResolvedValueOnce(token({
      email: "verified@example.test",
      email_verified: true,
    }));

    const response = await createEmailLinkRecoveryRouteHandlers(dependencies).PUT(request("/api/auth/email-link/recovery", {
      body: JSON.stringify({ idToken: "fresh-id-token", state: recoveryState }),
      headers: {
        "content-type": "application/json",
        cookie: `${EMAIL_LINK_RECOVERY_COOKIE}=${cookie}`,
      },
      method: "PUT",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ returnTo: "/vi/checkout?step=contact" });
  });

  it("atomically rejects a replay after the first matching identity consumes the transaction", async () => {
    const startResponse = await start();
    const cookie = startResponse.cookies.get(EMAIL_LINK_RECOVERY_COOKIE)?.value;
    verifyIdToken.mockResolvedValue(token({
      email: "verified@example.test",
      email_verified: true,
    }));
    const consumeRequest = () => request("/api/auth/email-link/recovery", {
      body: JSON.stringify({ idToken: "fresh-id-token", state: recoveryState }),
      headers: {
        "content-type": "application/json",
        cookie: `${EMAIL_LINK_RECOVERY_COOKIE}=${cookie}`,
      },
      method: "PUT",
    });
    const handlers = createEmailLinkRecoveryRouteHandlers(dependencies);

    const first = await handlers.PUT(consumeRequest());
    const replay = await handlers.PUT(consumeRequest());

    expect(first.status).toBe(200);
    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toEqual({ error: "recovery_replayed" });
    expect(replay.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(ledger.consume).toHaveBeenCalledTimes(2);
  });

  it("rejects a tampered signed cookie before consulting the durable ledger", async () => {
    const startResponse = await start();
    const cookie = startResponse.cookies.get(EMAIL_LINK_RECOVERY_COOKIE)?.value ?? "";
    const tamperedCookie = `${cookie.slice(0, -1)}${cookie.endsWith("a") ? "b" : "a"}`;

    const response = await createEmailLinkRecoveryRouteHandlers(dependencies).GET(request(
      `/api/auth/email-link/recovery?state=${recoveryState}`,
      { headers: { cookie: `${EMAIL_LINK_RECOVERY_COOKIE}=${tamperedCookie}` } },
    ));

    expect(response.status).toBe(400);
    expect(ledger.inspect).not.toHaveBeenCalled();
  });

  it("rejects a UID or verified-email mismatch without returning recovery metadata", async () => {
    const startResponse = await start();
    const cookie = startResponse.cookies.get(EMAIL_LINK_RECOVERY_COOKIE)?.value;
    verifyIdToken.mockResolvedValueOnce(token({
      email: "attacker@example.test",
      email_verified: true,
      sub: "different-user",
      uid: "different-user",
    }));

    const response = await createEmailLinkRecoveryRouteHandlers(dependencies).PUT(request("/api/auth/email-link/recovery", {
      body: JSON.stringify({ idToken: "wrong-user-token", state: recoveryState }),
      headers: {
        "content-type": "application/json",
        cookie: `${EMAIL_LINK_RECOVERY_COOKIE}=${cookie}`,
      },
      method: "PUT",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "recovery_identity_mismatch" });
    expect(ledger.consume).not.toHaveBeenCalled();
  });

  it("rejects cross-origin starts and stale authentication", async () => {
    const handlers = createEmailLinkRecoveryRouteHandlers(dependencies);
    const crossOrigin = await handlers.POST(new NextRequest("https://staging.nanohome.vn/api/auth/email-link/recovery", {
      body: "{}",
      headers: { Origin: "https://evil.example", "content-type": "application/json" },
      method: "POST",
    }));
    expect(crossOrigin.status).toBe(403);
    expect(verifyIdToken).not.toHaveBeenCalled();

    verifyIdToken.mockResolvedValueOnce(token({ auth_time: nowSeconds - 301 }));
    const stale = await start();
    expect(stale.status).toBe(403);
    await expect(stale.json()).resolves.toEqual({ error: "recent_sign_in_required" });
  });
});
