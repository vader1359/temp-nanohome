import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => ({
    title: "Complete",
    description: "Your sign-in is complete.",
    continue: "Continue",
  })[key] ?? key,
}));

import AccountCompletePage from "./page";

describe("AccountCompletePage", () => {
  it("renders a safe completion destination", async () => {
    // Given: a supported locale with a local destination.
    const props = { params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ returnTo: "/en/account?auth=login" }) };

    // When: the completion landing page renders.
    render(await AccountCompletePage(props));

    // Then: it retains only the safe destination.
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/en/account");
  });
});
