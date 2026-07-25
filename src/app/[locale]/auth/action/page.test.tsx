import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => ({
    "action.body": "This page is ready for the next secure step.",
    "action.title": "Continue securely",
    "common.continue": "Continue",
  })[key] ?? key,
}));

import AuthActionPage from "./page";

describe("AuthActionPage", () => {
  it("falls back to the locale home for an unsafe return destination", async () => {
    // Given: a supported locale with an external destination.
    const props = { params: Promise.resolve({ locale: "ko" }), searchParams: Promise.resolve({ returnTo: "https://attacker.test" }) };

    // When: the landing page renders.
    render(await AuthActionPage(props));

    // Then: it continues only to the locale home.
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/ko");
  });

  it("rejects an unsupported locale", async () => {
    // Given: an unsupported route locale.
    const props = { params: Promise.resolve({ locale: "xx" }), searchParams: Promise.resolve({}) };

    // When: the landing page renders.
    const renderPage = AuthActionPage(props);

    // Then: it fails closed.
    await expect(renderPage).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
