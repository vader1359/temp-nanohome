import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AccountLayout from "./layout";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));

describe("AccountLayout", () => {
  it("renders Account navigation and content for a supported locale", async () => {
    // Given: an Account route for a supported locale.
    const layout = await AccountLayout({
      children: <p>Profile content</p>,
      params: Promise.resolve({ locale: "vi" }),
    });

    // When: the route shell renders.
    render(layout);

    // Then: it exposes a responsive navigation landmark and main content.
    expect(screen.getByRole("navigation", { name: "Tài khoản" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Profile content");
    expect(screen.getByRole("heading", { level: 1, name: "Tài khoản" })).toBeInTheDocument();
  });
});
