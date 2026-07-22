import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductViewTracker } from "./product-view-tracker";

const productId = "00000000-0000-4000-8000-000000000021";
const variantId = "00000000-0000-4000-8000-000000000031";

const context = (analytics: boolean, personalization: boolean) => ({
  locale: "vi",
  consent: {
    analytics,
    personalization,
    aiProcessing: false,
    aiConversationStorage: false,
    roomImageProcessing: false,
    roomImageStorage: false,
    version: "2026-07",
  },
  capabilities: {},
});

describe("ProductViewTracker", () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000099");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
  ])("does not emit without analytics and personalization consent", async (analytics, personalization) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(context(analytics, personalization)), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    render(<ProductViewTracker productId={productId} variantId={variantId} />);

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledWith("/api/customer/context", expect.objectContaining({ cache: "no-store", credentials: "same-origin" }));
  });

  it("emits one allowlisted event with canonical UUIDs and no page text or URL", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(context(true, true)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "accepted" }), { status: 202 }));
    vi.stubGlobal("fetch", fetcher);

    render(<ProductViewTracker productId={productId} variantId={variantId} />);

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const [, init] = fetcher.mock.calls[1] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "product_viewed",
      properties: { productId, variantId, placement: "pdp" },
      idempotencyKey: "product_view_00000000-0000-4000-8000-000000000099",
    });
    expect(init).toMatchObject({ cache: "no-store", credentials: "same-origin", method: "POST" });

    window.dispatchEvent(new Event("nanohome:customer-context-changed"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
