import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ submit: vi.fn() }));

vi.mock("@/lib/account/auth-flow-ports.server", () => ({
  getAccountAuthFlowPort: () => ({ submit: ports.submit }),
}));

import { POST } from "./route";

describe("/api/account/auth-flow", () => {
  beforeEach(() => {
    ports.submit.mockReset();
  });

  it("returns a private no-store generic result for a valid local flow request", async () => {
    // Given: a fake result that never contains an account identifier.
    ports.submit.mockResolvedValue({ kind: "completed", returnTo: "/vi/products" });

    // When: the Account client starts password sign-in.
    const response = await POST(new Request("https://app.test/api/account/auth-flow", {
      body: JSON.stringify({ action: "start", locale: "vi", method: "password", password: "secret", returnTo: "/vi/products?auth=login" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));

    // Then: the API yields only a safe, non-cacheable flow response.
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toEqual({ kind: "completed", returnTo: "/vi/products" });
  });

  it("rejects an invalid request before it reaches the fake port", async () => {
    // Given: malformed JSON content.
    const request = new Request("https://app.test/api/account/auth-flow", {
      body: "{",
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    // When: the private endpoint receives it.
    const response = await POST(request);

    // Then: the error remains generic and no flow begins.
    expect(response.status).toBe(400);
    expect(ports.submit).not.toHaveBeenCalled();
  });
});
