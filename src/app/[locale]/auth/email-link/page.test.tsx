import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => ({
    "emailLink.title": "Continue securely",
  })[key] ?? key,
}));
vi.mock("./email-link-recovery", () => ({
  EmailLinkRecovery: (props: Readonly<{
    actionCode?: string;
    cleanPath: string;
    fallbackPath: string;
    mode?: string;
    recoveryState?: string;
  }>) => (
    <div
      data-action-code={props.actionCode}
      data-clean-path={props.cleanPath}
      data-mode={props.mode}
      data-recovery-state={props.recoveryState}
    >
      <a href={props.fallbackPath}>Continue</a>
    </div>
  ),
}));

import EmailLinkPage from "./page";

const recoveryState = "s".repeat(43);

describe("EmailLinkPage", () => {
  it("ignores a malicious legacy returnTo and exposes only a safe sign-in fallback", async () => {
    const props = {
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ returnTo: "https://evil.example/steal", state: "malformed" }),
    };

    render(await EmailLinkPage(props));

    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/en/account/sign-in");
    expect(screen.getByRole("link").parentElement).not.toHaveAttribute("data-recovery-state");
  });

  it("passes only an opaque direct recovery state to the client handler", async () => {
    const props = {
      params: Promise.resolve({ locale: "vi" }),
      searchParams: Promise.resolve({ state: recoveryState }),
    };

    render(await EmailLinkPage(props));

    const handler = screen.getByRole("link").parentElement;
    expect(handler).toHaveAttribute("data-recovery-state", recoveryState);
    expect(handler).toHaveAttribute("data-clean-path", "/vi/auth/email-link");
  });

  it("supports a Firebase custom-handler URL while keeping continueUrl non-authoritative", async () => {
    const props = {
      params: Promise.resolve({ locale: "ko" }),
      searchParams: Promise.resolve({
        continueUrl: `https://staging.nanohome.vn/ko/auth/email-link?state=${recoveryState}&returnTo=https://evil.example`,
        mode: "verifyAndChangeEmail",
        oobCode: "one-time-action-code",
      }),
    };

    render(await EmailLinkPage(props));

    const handler = screen.getByRole("link").parentElement;
    expect(handler).toHaveAttribute("data-recovery-state", recoveryState);
    expect(handler).toHaveAttribute("data-action-code", "one-time-action-code");
    expect(handler).toHaveAttribute("data-mode", "verifyAndChangeEmail");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/ko/account/sign-in");
  });

  it("rejects an unsupported locale", async () => {
    const props = { params: Promise.resolve({ locale: "xx" }), searchParams: Promise.resolve({}) };

    await expect(EmailLinkPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
