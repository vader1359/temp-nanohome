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
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      p_visitor_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      p_session_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(body)).not.toContain("a".repeat(64));
  });

  it("does not trust an unregistered token pair", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const repository = createCustomerRepository(fetcher);

    await expect(repository.resolveIdentity({ visitor: "a".repeat(64), session: "b".repeat(64) })).resolves.toEqual({ identity: null, status: "missing" });
  });

  it("uses the exact SQL argument names for identity bootstrap and consent lookup", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { visitor_id: "visitor-db", session_id: "session-db", status: "created" },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ analytics: false }), { status: 200 }));
    const repository = createCustomerRepository(fetcher);

    await repository.bootstrapIdentity({ visitor: "a".repeat(64), session: "b".repeat(64) });
    await repository.currentConsent({ visitorId: "visitor-db", sessionId: "session-db" });

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      p_visitor_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      p_session_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ p_visitor_id: "visitor-db" });
  });

  it("persists consent and events through typed RPC boundaries", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ policy_version: "2026-07", analytics: true, personalization: false, ai_processing: false, ai_conversation_storage: false, room_image_processing: false, room_image_storage: false, marketing: false, locale: "vi", source: "banner" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("accepted"), { status: 200 }));
    const repository = createCustomerRepository(fetcher);

    await expect(repository.appendConsent({ visitorId: "visitor-db", sessionId: "session-db" }, { essential: true, analytics: true, version: "2026-07" })).resolves.toMatchObject({ version: "2026-07", analytics: true });
    const event = { name: "page_viewed" as const, properties: { routeKey: "/", locale: "vi" as const }, idempotencyKey: "event_key_0000001" };
    await expect(repository.appendEvent({ visitorId: "visitor-db", sessionId: "session-db" }, event, "2026-07-21T00:00:00.000Z")).resolves.toBe("accepted");

    const consentBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(Object.keys(consentBody).sort()).toEqual(["p_consent", "p_session_id", "p_visitor_id"]);
    expect(consentBody).toEqual(expect.objectContaining({
      p_visitor_id: "visitor-db",
      p_session_id: "session-db",
      p_consent: expect.objectContaining({ analytics: true, version: "2026-07" }),
    }));

    const eventBody = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(Object.keys(eventBody).sort()).toEqual(["p_event", "p_received_at", "p_session_id", "p_visitor_id"]);
    expect(eventBody).toEqual({
      p_visitor_id: "visitor-db",
      p_session_id: "session-db",
      p_event: event,
      p_received_at: "2026-07-21T00:00:00.000Z",
    });
  });

  it("binds only the server-verified user and clears authentication without browser identity input", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify("bound"), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("cleared"), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify("rate_limited"), { status: 200 }));
    const repository = createCustomerRepository(fetcher);
    const identity = { visitorId: "00000000-0000-4000-8000-000000000201", sessionId: "00000000-0000-4000-8000-000000000202" };

    await expect(repository.bindVerifiedUser(identity, "00000000-0000-4000-8000-000000000061")).resolves.toBe("bound");
    await expect(repository.clearVerifiedUser(identity)).resolves.toBe("cleared");
    await expect(repository.appendEvent(identity, { name: "page_viewed", properties: { routeKey: "/", locale: "vi" }, idempotencyKey: "event_key_0000001" }, "2026-07-23T00:00:00.000Z")).resolves.toBe("rate_limited");

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      p_visitor_id: identity.visitorId,
      p_session_id: identity.sessionId,
      p_user_id: "00000000-0000-4000-8000-000000000061",
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      p_visitor_id: identity.visitorId,
      p_session_id: identity.sessionId,
    });
  });
});
