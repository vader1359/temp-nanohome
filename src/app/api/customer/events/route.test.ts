import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const cookie = `nano_visitor_id=${"a".repeat(64)}; nano_session_id=${"b".repeat(64)}`;
const productId = "00000000-0000-4000-8000-000000000021";
const variantId = "00000000-0000-4000-8000-000000000031";
const event = {
  name: "product_viewed",
  properties: { productId, variantId, placement: "pdp" },
  idempotencyKey: "product_view_0000000000000001",
} as const;

const request = (body: unknown = event, headers: HeadersInit = {}) => new Request("https://app.test/api/customer/events", {
  method: "POST",
  headers: { "content-type": "application/json", cookie, origin: "https://app.test", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

const pipeline = (consent: Readonly<{ analytics: boolean; personalization: boolean }>, result: "accepted" | "duplicate" | "rate_limited" = "accepted") => vi.fn<typeof fetch>()
  .mockResolvedValueOnce(new Response(JSON.stringify([{ visitor_id: "00000000-0000-4000-8000-000000000201", session_id: "00000000-0000-4000-8000-000000000202", status: "active" }]), { status: 200 }))
  .mockResolvedValueOnce(new Response(JSON.stringify({ ...consent, policy_version: "2026-07" }), { status: 200 }))
  .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }));

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/customer/events", () => {
  it("fails closed when Origin is absent or mismatched", async () => {
    const absent = await POST(new Request("https://app.test/api/customer/events", { method: "POST" }));
    const mismatched = await POST(new Request("https://app.test/api/customer/events", { method: "POST", headers: { origin: "https://evil.test" } }));

    expect(absent.status).toBe(403);
    expect(mismatched.status).toBe(403);
  });

  it("rejects malformed, oversized, and non-JSON event bodies", async () => {
    const fetcher = pipeline({ analytics: true, personalization: true });
    vi.stubGlobal("fetch", fetcher);

    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request("x".repeat(4_097)))).status).toBe(413);
    expect((await POST(request("{}", { "content-type": "text/plain" }))).status).toBe(415);
  });

  it("requires canonical product and variant UUIDs", async () => {
    vi.stubGlobal("fetch", pipeline({ analytics: true, personalization: true }));
    const response = await POST(request({
      ...event,
      properties: { productId: "product-slug", variantId: "variant-slug", placement: "pdp" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid event" });
  });

  it.each([
    { analytics: false, personalization: false },
    { analytics: true, personalization: false },
    { analytics: false, personalization: true },
  ])("does not persist a product view without both required consents", async (consent) => {
    const fetcher = pipeline(consent);
    vi.stubGlobal("fetch", fetcher);

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("persists server-resolved identity and a server receive time", async () => {
    const fetcher = pipeline({ analytics: true, personalization: true });
    vi.stubGlobal("fetch", fetcher);

    const response = await POST(request());

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const eventBody = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body)) as Record<string, unknown>;
    expect(eventBody).toEqual({
      p_visitor_id: "00000000-0000-4000-8000-000000000201",
      p_session_id: "00000000-0000-4000-8000-000000000202",
      p_event: event,
      p_received_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
    });
    expect(JSON.stringify(eventBody)).not.toContain("userId");
  });

  it("reports durable duplicate and rate-limit outcomes", async () => {
    const duplicateFetcher = pipeline({ analytics: true, personalization: true }, "duplicate");
    vi.stubGlobal("fetch", duplicateFetcher);
    const duplicate = await POST(request());
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toEqual({ status: "duplicate" });

    const limitedFetcher = pipeline({ analytics: true, personalization: true }, "rate_limited");
    vi.stubGlobal("fetch", limitedFetcher);
    const limited = await POST(request());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
