import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../../messages/en.json";
import { FirebaseAuthUiError } from "@/lib/auth/firebase-browser-auth";
import { EmailLinkRecovery } from "./email-link-recovery";

function renderRecovery(
  recoverEmailLinkSession: (locale: string, returnTo: string, intent?: "account" | "checkout") => Promise<string | null>,
  navigate = vi.fn(),
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <EmailLinkRecovery
        authPort={{ recoverEmailLinkSession }}
        intent="checkout"
        locale="en"
        navigate={navigate}
        returnTo="/en/checkout"
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
  });

  it("creates the checkout session and returns to the safe destination", async () => {
    const recoverEmailLinkSession = vi.fn(async () => "/en/checkout");
    const navigate = vi.fn();

    renderRecovery(recoverEmailLinkSession, navigate);

    await waitFor(() => expect(recoverEmailLinkSession).toHaveBeenCalledWith("en", "/en/checkout", "checkout"));
    expect(navigate).toHaveBeenCalledWith("/en/checkout");
  });

  it("signals the original tab when the second tab has no Firebase user", async () => {
    const recoverEmailLinkSession = vi.fn(async () => null);

    renderRecovery(recoverEmailLinkSession);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Return to the original checkout tab"));
    const marker = window.localStorage.getItem("nanohome-email-link-recovery");
    expect(marker).toMatch(/email_verification_complete/iu);
    expect(marker).not.toContain("@");
    expect(marker).not.toContain("/en/checkout");
  });

  it("shows a specific expired-link state instead of unknown", async () => {
    const recoverEmailLinkSession = vi.fn(async () => {
      throw new FirebaseAuthUiError("code_expired");
    });

    renderRecovery(recoverEmailLinkSession);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("verification link has expired"));
  });
});
