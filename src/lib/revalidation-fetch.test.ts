import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RemoteWriteBlockedError,
  supabaseRevalidationFetch,
} from "@/lib/remote-read-only";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Supabase revalidation fetch", () => {
  it("forwards the replay-ledger POST", async () => {
    // Given: a scoped client and the sole authorized write path.
    const networkFetch = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", networkFetch);

    // When: the client claims a webhook event.
    const response = await supabaseRevalidationFetch(
      "https://example.supabase.co/rest/v1/revalidation_webhook_events",
      { method: "POST", body: JSON.stringify({ event_id: "00000000-0000-4000-8000-000000000301" }) },
    );

    // Then: only this write reaches Supabase.
    expect(response).toBeInstanceOf(Response);
    expect(networkFetch).toHaveBeenCalledOnce();
  });

  it.each([
    ["POST", "/rest/v1/variants"],
    ["PATCH", "/rest/v1/revalidation_webhook_events"],
    ["DELETE", "/rest/v1/revalidation_webhook_events"],
    ["POST", "/rest/v1/revalidation_webhook_events/extra"],
  ])("blocks the scoped client %s %s before network I/O", async (method, path) => {
    // Given: a client constrained to the replay ledger write.
    const networkFetch = vi.fn();
    vi.stubGlobal("fetch", networkFetch);

    // When: it attempts an unapproved write.
    const request = supabaseRevalidationFetch(`https://example.supabase.co${path}`, { method });

    // Then: the safeguard rejects it before a remote request occurs.
    await expect(request).rejects.toBeInstanceOf(RemoteWriteBlockedError);
    expect(networkFetch).not.toHaveBeenCalled();
  });
});
