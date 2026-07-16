import { afterEach, describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
}));

const replayMocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  createRevalidationAdminClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: cacheMocks.revalidateTag,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createRevalidationAdminClient: replayMocks.createRevalidationAdminClient,
}));

afterEach(() => {
  cacheMocks.revalidateTag.mockReset();
  replayMocks.from.mockReset();
  replayMocks.insert.mockReset();
  replayMocks.createRevalidationAdminClient.mockReset();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("POST /api/revalidate", () => {
  it("rejects an invalid secret before claiming an event or invalidating cache tags", async () => {
    // Given: a configured webhook secret and a request with a different bearer token.
    configureRoute();
    const { POST } = await import("./route");

    // When: an untrusted sender submits a publish event.
    const response = await POST(revalidationRequest("wrong-secret", publishedHeroEvent()));

    // Then: the route rejects the request before any database or cache work.
    expect(response.status).toBe(401);
    expect(replayMocks.createRevalidationAdminClient).not.toHaveBeenCalled();
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads before claiming an event", async () => {
    // Given: an authorized sender and a malformed JSON body.
    configureRoute();
    const { POST } = await import("./route");
    const request = new Request("https://app.test/api/revalidate", {
      method: "POST",
      headers: { Authorization: "Bearer revalidate-test" },
      body: "{",
    });

    // When: the route parses the malformed payload.
    const response = await POST(request);

    // Then: it rejects the request before database or cache work.
    expect(response.status).toBe(400);
    expect(replayMocks.createRevalidationAdminClient).not.toHaveBeenCalled();
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("claims a draft event without invalidating cache tags", async () => {
    // Given: an authorized draft event and an available durable claim.
    configureRoute();
    const { POST } = await import("./route");

    // When: the route accepts the draft event.
    const response = await POST(revalidationRequest("revalidate-test", {
      ...publishedHeroEvent(),
      published: false,
    }));

    // Then: the event is claimed but no public content tag is invalidated.
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ revalidated: false });
    expect(replayMocks.from).toHaveBeenCalledWith("revalidation_webhook_events");
    expect(replayMocks.insert).toHaveBeenCalledWith({ event_id: publishedHeroEvent().eventId });
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("claims a published CMS event before invalidating homepage tags", async () => {
    // Given: a published hero update from the configured webhook sender.
    configureRoute();
    const { POST } = await import("./route");

    // When: the sender requests revalidation.
    const response = await POST(revalidationRequest("revalidate-test", publishedHeroEvent()));

    // Then: the event is durably claimed before Next 16 cache invalidation.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revalidated: true });
    expect(replayMocks.from).toHaveBeenCalledWith("revalidation_webhook_events");
    expect(replayMocks.insert).toHaveBeenCalledWith({ event_id: publishedHeroEvent().eventId });
    expect(cacheMocks.revalidateTag).toHaveBeenCalledTimes(2);
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith("homepage", "max");
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith("homepage:en", "max");
  });

  it("rejects a duplicate event without invalidating tags", async () => {
    // Given: a valid event whose database claim collides with an existing ID.
    configureRoute({ code: "23505" });
    const { POST } = await import("./route");

    // When: the duplicate event is received.
    const response = await POST(revalidationRequest("revalidate-test", publishedHeroEvent()));

    // Then: the replay is explicit and cache invalidation does not happen.
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Duplicate event" });
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("returns a server error when claiming an event fails", async () => {
    // Given: a valid event whose claim fails for a non-unique database reason.
    configureRoute({ code: "42501" });
    const { POST } = await import("./route");

    // When: the route attempts to claim the event.
    const response = await POST(revalidationRequest("revalidate-test", publishedHeroEvent()));

    // Then: it exposes no database details and does not invalidate tags.
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to process event" });
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects webhook tables outside the CMS publish allowlist before claiming an event", async () => {
    // Given: an authorized sender with an unrelated table event.
    configureRoute();
    const { POST } = await import("./route");

    // When: it requests revalidation for a protected operational table.
    const response = await POST(revalidationRequest("revalidate-test", {
      ...publishedHeroEvent(),
      table: "amis_sync_log",
    }));

    // Then: the route refuses it before database and cache work.
    expect(response.status).toBe(400);
    expect(replayMocks.createRevalidationAdminClient).not.toHaveBeenCalled();
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled();
  });
});

type RevalidationEvent = {
  readonly eventId: string;
  readonly locale: string;
  readonly published: boolean;
  readonly table: string;
};

type ClaimError = { readonly code: string } | null;

function publishedHeroEvent(): RevalidationEvent {
  return {
    eventId: "00000000-0000-4000-8000-000000000201",
    locale: "en",
    published: true,
    table: "hero_slides",
  };
}

function revalidationRequest(secret: string, payload: RevalidationEvent): Request {
  return new Request("https://app.test/api/revalidate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function configureRoute(error: ClaimError = null): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubEnv("CRON_SECRET", "cron-test");
  vi.stubEnv("REVALIDATE_SECRET", "revalidate-test");
  vi.stubEnv("PREVIEW_SECRET", "preview-test");
  replayMocks.insert.mockResolvedValue({ error });
  replayMocks.from.mockReturnValue({ insert: replayMocks.insert });
  replayMocks.createRevalidationAdminClient.mockReturnValue({ from: replayMocks.from });
}
