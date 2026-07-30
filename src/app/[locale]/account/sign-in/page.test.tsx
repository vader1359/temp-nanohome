import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/components/account/account-auth-flow", () => ({
  AccountAuthFlow: ({ intent, locale, returnTo }: { readonly intent?: string; readonly locale: string; readonly returnTo: string }) => <div>{`${locale}:${intent ?? "account"}:${returnTo}`}</div>,
}));

import AccountSignInPage from "./page";

describe("AccountSignInPage", () => {
  it("passes a safe locale-prefixed destination without drawer state to the Account flow", async () => {
    // Given: a supported locale and legacy auth state in the destination.
    const props = { params: Promise.resolve({ locale: "vi" }), searchParams: Promise.resolve({ returnTo: "/vi/products?auth=login&q=chair" }) };

    // When: the Account sign-in landing page renders.
    render(await AccountSignInPage(props));

    // Then: the client receives only the safe normalized destination.
    expect(screen.getByText("vi:account:/vi/products?q=chair")).toBeInTheDocument();
  });

  it("preserves checkout intent while returning to the safe checkout route", async () => {
    // Given: checkout initiated authentication with a stale drawer parameter.
    const props = {
      params: Promise.resolve({ locale: "vi" }),
      searchParams: Promise.resolve({ intent: "checkout", returnTo: "/vi/checkout?step=contact&auth=login" }),
    };

    // When: the sign-in landing page renders.
    render(await AccountSignInPage(props));

    // Then: the flow receives checkout intent and no auth query noise.
    expect(screen.getByText("vi:checkout:/vi/checkout?step=contact")).toBeInTheDocument();
  });

  it("rejects an unsupported locale", async () => {
    // Given: an unsupported route locale.
    const props = { params: Promise.resolve({ locale: "xx" }), searchParams: Promise.resolve({}) };

    // When: the sign-in landing page renders.
    const renderPage = AccountSignInPage(props);

    // Then: the route fails closed instead of constructing a destination.
    await expect(renderPage).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
