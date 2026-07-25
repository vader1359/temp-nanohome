import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getSecurity: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountSecurityPort: () => ({ getSecurity: ports.getSecurity }),
}));

vi.mock("@/components/account/account-security-form", () => ({
  AccountSecurityForm: () => <div>Account security form</div>,
}));

import AccountSecurityPage, { dynamic } from "./page";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [],
} as const;

const security = {
  account,
  email: { address: "an@example.com", verified: true },
  phone: { number: "+84901234567", verified: true },
  sessions: [],
  hasPassword: true,
  deletionRequested: false,
} as const;

describe("AccountSecurityPage", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.getSecurity.mockReset();
  });

  it("renders a neutral unavailable state for anonymous access", async () => {
    // Given: no authenticated account session.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: the security page renders.
    render(await AccountSecurityPage());

    // Then: dynamic mode is forced, neutral unavailable copy is rendered, and security port is not called.
    expect(dynamic).toBe("force-dynamic");
    expect(screen.getByText("Bảo mật tài khoản hiện chưa khả dụng.")).toBeInTheDocument();
    expect(ports.getSecurity).not.toHaveBeenCalled();
  });

  it("renders the security form for an authenticated account", async () => {
    // Given: an authenticated account and its security overview model.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getSecurity.mockResolvedValue(security);

    // When: the security page renders.
    render(await AccountSecurityPage());

    // Then: it fetches security overview for account and presents the safe form surface.
    expect(screen.getByText("Account security form")).toBeInTheDocument();
    expect(ports.getSecurity).toHaveBeenCalledWith(account);
  });
});
