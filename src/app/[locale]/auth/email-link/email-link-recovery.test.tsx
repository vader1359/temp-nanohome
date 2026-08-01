import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../messages/en.json";
import {
  FirebaseAuthUiError,
  type EmailLinkRecoveryInput,
} from "@/lib/auth/firebase-browser-auth";
import { EmailLinkRecovery } from "./email-link-recovery";

const recoveryState = "s".repeat(43);

function renderRecovery(
  recoverEmailLinkSession: (input: EmailLinkRecoveryInput) => Promise<string | null>,
  navigate = vi.fn(),
  state: string | null = recoveryState,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <EmailLinkRecovery
        authPort={{ recoverEmailLinkSession }}
        cleanPath="/en/auth/email-link"
        fallbackPath="/en/account/sign-in"
        locale="en"
        navigate={navigate}
        recoveryState={state ?? undefined}
      />
    </NextIntlClientProvider>,
  );
}

describe("EmailLinkRecovery", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    window.history.replaceState({}, "", "/en/auth/email-link");
  });

  it("creates the checkout session from the server-bound recovery state", async () => {
    const recoverEmailLinkSession = vi.fn(async () => "/en/checkout");
    const navigate = vi.fn();

    renderRecovery(recoverEmailLinkSession, navigate);

    await waitFor(() => expect(recoverEmailLinkSession).toHaveBeenCalledWith({
      actionCode: undefined,
      locale: "en",
      mode: undefined,
      state: recoveryState,
    }));
    expect(navigate).toHaveBeenCalledWith("/en/checkout");
  });

  it("signals the original tab without claiming that email verification is complete", async () => {
    const recoverEmailLinkSession = vi.fn(async () => null);

    renderRecovery(recoverEmailLinkSession);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("callback was accepted"));
    expect(screen.getByRole("status")).not.toHaveTextContent("email is verified");
    const marker = window.localStorage.getItem("nanohome-email-link-recovery");
    expect(marker).toContain(recoveryState);
    expect(marker).not.toContain("@");
    expect(marker).not.toContain("/en/checkout");
  });

  it("shows a specific expired-link state", async () => {
    const recoverEmailLinkSession = vi.fn(async () => {
      throw new FirebaseAuthUiError("code_expired");
    });

    renderRecovery(recoverEmailLinkSession);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("verification link has expired"));
  });

  it("fails closed without a recovery state and removes untrusted query parameters", async () => {
    const recoverEmailLinkSession = vi.fn(async () => "/en/checkout");
    window.history.replaceState({}, "", "/en/auth/email-link?returnTo=https%3A%2F%2Fevil.example&oobCode=secret");

    renderRecovery(recoverEmailLinkSession, vi.fn(), null);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("no longer valid"));
    expect(recoverEmailLinkSession).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/en/auth/email-link");
    expect(window.location.search).toBe("");
    expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/en/account/sign-in");
  });

  it("shows a specific recent-sign-in recovery message", async () => {
    const recoverEmailLinkSession = vi.fn(async () => {
      throw new FirebaseAuthUiError("recent_sign_in_required");
    });

    renderRecovery(recoverEmailLinkSession);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sign in again"));
  });

  it("shows a specific already-used recovery message", async () => {
    const recoverEmailLinkSession = vi.fn(async () => {
      throw new FirebaseAuthUiError("email_link_used");
    });

    renderRecovery(recoverEmailLinkSession);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("already been used"));
  });
});
