import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => ({
    "common.continue": "Continue",
    "emailLink.body": "You can return to your destination when you are ready.",
    "emailLink.title": "Continue securely",
  })[key] ?? key,
}));
vi.mock("./email-link-recovery", () => ({
  EmailLinkRecovery: ({ returnTo }: { readonly returnTo: string }) => <a href={returnTo}>Continue</a>,
}));

import EmailLinkPage from "./page";

describe("EmailLinkPage", () => {
  it("renders a safe return destination", async () => {
    // Given: a supported locale with legacy drawer state in a local destination.
    const props = { params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ returnTo: "/en/account?auth=login" }) };

    // When: the landing page renders.
    render(await EmailLinkPage(props));

    // Then: it continues only to the normalized local path.
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/en/account");
  });

  it("preserves a checkout destination after the email action returns", async () => {
    // Given: email verification was started from checkout.
    const props = {
      params: Promise.resolve({ locale: "vi" }),
      searchParams: Promise.resolve({ returnTo: "/vi/checkout?step=contact&auth=login" }),
    };

    // When: the email-action landing page renders.
    render(await EmailLinkPage(props));

    // Then: the intended checkout step survives without auth query noise.
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/vi/checkout?step=contact");
  });

  it("rejects an unsupported locale", async () => {
    // Given: an unsupported route locale.
    const props = { params: Promise.resolve({ locale: "xx" }), searchParams: Promise.resolve({}) };

    // When: the landing page renders.
    const renderPage = EmailLinkPage(props);

    // Then: it fails closed.
    await expect(renderPage).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
