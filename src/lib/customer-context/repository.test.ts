import { describe, expect, it, vi } from "vitest";
import { createCustomerRepository } from "./repository";

describe("customer repository", () => {
  it("hashes tokens before resolving them through the server RPC", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { visitor_id: "visitor-db", session_id: "session-db", status: "active" },
    ]), { status: 200 }));
    const repository = createCustomerRepository(fetcher);

    const result = await repository.resolveIdentity({ visitor: "a".repeat(64), session: "b".repeat(64) });

    expect(result).toEqual({ identity: { visitorId: "visitor-db", sessionId: "session-db" }, status: "active" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://supabase.test/rest/v1/rpc/resolve_customer_identity_v2",
      expect.objectContaining({ method: "POST", body: expect.stringContaining("visitor_token_hash") }),
    );
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain("a".repeat(64));
  });

  it("does not trust an unregistered token pair", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const repository = createCustomerRepository(fetcher);

    await expect(repository.resolveIdentity({ visitor: "a".repeat(64), session: "b".repeat(64) })).resolves.toEqual({ identity: null, status: "missing" });
  });

  it("persists consent and events through typed RPC boundaries", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ policy_version: "2026-07", analytics: true, personalization: false, ai_processing: false, ai_conversation_storage: false, room_image_processing: false, room_image_storage: false, marketing: false, locale: "vi", source: "banner" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("accepted"), { status: 200 }));
    const repository = createCustomerRepository(fetcher);

    await expect(repository.appendConsent({ visitorId: "visitor-db", sessionId: "session-db" }, { essential: true, analytics: true, version: "2026-07" })).resolves.toMatchObject({ version: "2026-07", analytics: true });
    await expect(repository.appendEvent({ visitorId: "visitor-db", sessionId: "session-db" }, { name: "page_viewed", properties: { routeKey: "/", locale: "vi" } }, "2026-07-21T00:00:00.000Z")).resolves.toBe("accepted");
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain("visitor_id");
    expect(String(fetcher.mock.calls[1]?.[1]?.body)).toContain("received_at");
  });
});
