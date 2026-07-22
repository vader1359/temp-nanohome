import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentCenter } from "./consent-center";

const messages = {
  title: "Privacy choices",
  description: "Choose how optional data is used.",
  storageNotice: "Storage and marketing stay off.",
  essentialOnly: "Essential only",
  improveExperience: "Improve experience",
  settings: "Privacy settings",
  withdraw: "Withdraw optional consent",
  close: "Close",
  retry: "Try again",
  error: "Choices could not be saved.",
};

const context = (version: string, analytics = false, personalization = false) => ({
  locale: "vi",
  consent: {
    analytics,
    personalization,
    aiProcessing: analytics && personalization,
    aiConversationStorage: false,
    roomImageProcessing: false,
    roomImageStorage: false,
    version,
  },
  capabilities: {},
});

const renderCenter = () => render(
  <NextIntlClientProvider locale="vi" messages={{ Privacy: messages }}>
    <ConsentCenter locale="vi" />
  </NextIntlClientProvider>,
);

afterEach(() => vi.unstubAllGlobals());

describe("ConsentCenter", () => {
  it("offers equal first-visit choices without sending optional consent automatically", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(context("none")), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    renderCenter();

    expect(await screen.findByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Essential only" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Improve experience" })).toBeEnabled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("enables only analytics, personalization, and AI processing for the experience choice", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(context("none")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(context("2026-07-23", true, true)), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    renderCenter();

    fireEvent.click(await screen.findByRole("button", { name: "Improve experience" }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const payload = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      analytics: true,
      personalization: true,
      aiProcessing: true,
      aiConversationStorage: false,
      roomImageProcessing: false,
      roomImageStorage: false,
      marketing: false,
      locale: "vi",
      source: "banner",
    });
  });

  it("persists an explicit essential-only choice with every optional purpose off", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(context("none")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(context("2026-07-23")), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    renderCenter();

    fireEvent.click(await screen.findByRole("button", { name: "Essential only" }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const payload = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(Object.entries(payload).filter(([key]) => ["analytics", "personalization", "aiProcessing", "aiConversationStorage", "roomImageProcessing", "roomImageStorage", "marketing"].includes(key)).every(([, value]) => value === false)).toBe(true);
  });

  it("allows a later withdrawal and fails closed when persistence is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(context("2026-07-23", true, true)), { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    renderCenter();

    fireEvent.click(await screen.findByRole("button", { name: "Privacy settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Withdraw optional consent" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Choices could not be saved.");
    const payload = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({ withdrawn: true, withdrawalReason: "customer privacy choice" });
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("opens the single global settings surface for feature consent prompts", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(context("2026-07-23")), { status: 200 })));
    renderCenter();
    expect(await screen.findByRole("button", { name: "Privacy settings" })).toBeVisible();

    act(() => window.dispatchEvent(new Event("nanohome:open-consent-settings")));

    expect(await screen.findByRole("dialog")).toBeVisible();
  });
});
