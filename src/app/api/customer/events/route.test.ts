import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/customer/events", () => {
  it("fails closed when Origin is absent", async () => {
    const response = await POST(new Request("https://app.test/api/customer/events", { method: "POST" }));
    expect(response.status).toBe(403);
  });

  it("rejects a mismatched Origin", async () => {
    const response = await POST(new Request("https://app.test/api/customer/events", { method: "POST", headers: { origin: "https://evil.test" } }));
    expect(response.status).toBe(403);
  });

  it("fails closed before accepting any event without an approved rate policy", async () => {
    const response = await POST(new Request("https://app.test/api/customer/events", {
      method: "POST",
      headers: { origin: "https://app.test", cookie: "nano_visitor_id=" + "a".repeat(64) + "; nano_session_id=" + "b".repeat(64) },
      body: JSON.stringify({ name: "page_viewed", properties: { routeKey: "/", locale: "vi" }, idempotencyKey: "event_key_0000001" }),
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Event collection policy unavailable" });
  });
});
