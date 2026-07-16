import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const draftMocks = vi.hoisted(() => ({
  disable: vi.fn(),
  enable: vi.fn(),
}));

vi.mock("next/headers", () => ({
  draftMode: vi.fn(async () => draftMocks),
}));

afterEach(() => {
  draftMocks.disable.mockReset();
  draftMocks.enable.mockReset();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("GET /api/preview", () => {
  it("rejects a request with an invalid signed preview token", async () => {
    // Given: a configured reviewer-only preview signing secret.
    setRouteEnv();
    const { GET } = await import("./route");

    // When: an untrusted request asks to enable preview.
    const response = await GET(previewRequest("/", "invalid-token", futureExpiry()));

    // Then: Draft Mode stays disabled and the request is rejected.
    expect(response.status).toBe(401);
    expect(draftMocks.enable).not.toHaveBeenCalled();
  });

  it("rejects expired preview tokens", async () => {
    // Given: a correctly signed token whose expiry is in the past.
    setRouteEnv();
    const { GET } = await import("./route");
    const expiresAt = Math.floor(Date.now() / 1000) - 1;

    // When: the reviewer uses the expired link.
    const response = await GET(previewRequest("/", signPreview("/", expiresAt), expiresAt));

    // Then: the route rejects it before enabling Draft Mode.
    expect(response.status).toBe(401);
    expect(draftMocks.enable).not.toHaveBeenCalled();
  });

  it("rejects paths outside the temporary homepage allowlist", async () => {
    // Given: a signed request before CMS page lookup is implemented.
    setRouteEnv();
    const { GET } = await import("./route");
    const path = "//attacker.test";
    const expiresAt = futureExpiry();

    // When: the reviewer supplies an arbitrary redirect path.
    const response = await GET(previewRequest(path, signPreview(path, expiresAt), expiresAt));

    // Then: the route rejects the open-redirect attempt.
    expect(response.status).toBe(400);
    expect(draftMocks.enable).not.toHaveBeenCalled();
  });

  it("enables preview only for the homepage and redirects locally", async () => {
    // Given: a signed reviewer link for the approved homepage path.
    setRouteEnv();
    const { GET } = await import("./route");
    const expiresAt = futureExpiry();

    // When: the reviewer enables Draft Mode.
    const response = await GET(previewRequest("/", signPreview("/", expiresAt), expiresAt));

    // Then: Next Draft Mode is enabled and the request remains on this origin.
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.test/");
    expect(draftMocks.enable).toHaveBeenCalledOnce();
  });
});

describe("GET /api/preview/exit", () => {
  it("disables draft mode and redirects to the homepage", async () => {
    // Given: a browser that has previously entered Draft Mode.
    setRouteEnv();
    const { GET } = await import("./exit/route");

    // When: it leaves preview.
    const response = await GET(new Request("https://app.test/api/preview/exit"));

    // Then: Draft Mode is disabled and the browser returns to the public homepage.
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.test/");
    expect(draftMocks.disable).toHaveBeenCalledOnce();
  });
});

function futureExpiry(): number {
  return Math.floor(Date.now() / 1000) + 60;
}

function previewRequest(path: string, token: string, expiresAt: number): Request {
  const query = new URLSearchParams({ expiresAt: String(expiresAt), path, token });
  return new Request(`https://app.test/api/preview?${query}`);
}

function signPreview(path: string, expiresAt: number): string {
  return createHmac("sha256", "preview-test").update(`${path}:${expiresAt}`).digest("hex");
}

function setRouteEnv(): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubEnv("CRON_SECRET", "cron-test");
  vi.stubEnv("REVALIDATE_SECRET", "revalidate-test");
  vi.stubEnv("PREVIEW_SECRET", "preview-test");
}
