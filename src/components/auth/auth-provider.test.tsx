import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("./auth-panel", () => ({
  AuthPanel: () => <div role="dialog">Authentication panel</div>,
}));

import { AuthProvider } from "./auth-provider";

describe("AuthProvider", () => {
  it("does not mount the authentication dialog without an auth query", () => {
    // Given: a localized page with no auth state in its URL.
    navigation.searchParams = new URLSearchParams();

    // When: the provider renders its normal application surface.
    render(<AuthProvider isAuthenticated={false}><main>Catalog</main></AuthProvider>);

    // Then: no offscreen modal dialog remains in the page DOM.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mounts the authentication dialog when the URL requests it", async () => {
    // Given: a localized page with the login auth state in its URL.
    navigation.searchParams = new URLSearchParams("auth=login");

    // When: the provider renders the requested authentication state.
    render(<AuthProvider isAuthenticated={false}><main>Catalog</main></AuthProvider>);

    // Then: the dialog is available for the requested user action.
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });
});
