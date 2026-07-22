import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerPersonalizationPanel } from "./customer-personalization-panel";

const authState = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ isAuthenticated: authState.isAuthenticated }),
}));

describe("CustomerPersonalizationPanel", () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not request or render account data for a signed-out visitor", () => {
    authState.isAuthenticated = false;
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);

    const { container } = render(<CustomerPersonalizationPanel locale="en" />);

    expect(container).toBeEmptyDOMElement();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("renders consented preferences, recent IDs, and the safe memory summary without write controls", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        enabled: true,
        consent: true,
        mode: "hybrid",
        preferences: [{ key: "material", value: "linen", labelKey: "material_tag" }],
        recent: [{ entityType: "variant", entityId: "variant-1" }],
        memoryConnected: true,
        memorySummary: "Prefers calm living rooms.",
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    render(<CustomerPersonalizationPanel locale="en" />);

    expect(await screen.findByText("Your preferences")).toBeVisible();
    expect(screen.getByText("linen")).toBeVisible();
    expect(screen.getByText("variant-1")).toBeVisible();
    expect(screen.getByText("Prefers calm living rooms.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/customer/context",
      "/api/customer/personalization?locale=en",
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ cache: "no-store", credentials: "same-origin" });
    }
  });

  it("falls back to non-personalized copy when the runtime is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", {
      status: 503,
    })));

    render(<CustomerPersonalizationPanel locale="en" />);

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.getByText("A considered selection for your home")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
