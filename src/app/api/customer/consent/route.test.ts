import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/customer/consent", () => {
  it("fails closed when Origin is absent", async () => {
    const response = await POST(new Request("https://app.test/api/customer/consent", { method: "POST" }));
    expect(response.status).toBe(403);
  });

  it("rejects a mismatched Origin", async () => {
    const response = await POST(new Request("https://app.test/api/customer/consent", { method: "POST", headers: { origin: "https://evil.test" } }));
    expect(response.status).toBe(403);
  });

  it("rejects a syntactically valid but unregistered identity", async () => {
    const response = await POST(new Request("https://app.test/api/customer/consent", {
      method: "POST",
      headers: { origin: "https://app.test", cookie: "nano_visitor_id=" + "a".repeat(64) + "; nano_session_id=" + "b".repeat(64) },
      body: JSON.stringify({ analytics: true, version: "2", locale: "en", source: "banner" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Identity required" });
  });

  it("rejects malformed consent", async () => {
    const response = await POST(new Request("https://app.test/api/customer/consent", {
      method: "POST",
      headers: { origin: "https://app.test", cookie: "nano_visitor_id=" + "a".repeat(64) + "; nano_session_id=" + "b".repeat(64) },
      body: JSON.stringify({ analytics: "yes" }),
    }));

    expect(response.status).toBe(401);
  });
});
