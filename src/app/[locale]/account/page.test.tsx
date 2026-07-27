import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  getAuthenticatedAccount: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountProfilePort: () => ({ getProfile: ports.getProfile }),
}));

vi.mock("@/components/account/account-profile-form", () => ({
  AccountProfileForm: () => <div>Profile form</div>,
}));

import AccountProfilePage from "./page";

const account = {
  accountId: "account_01",
  firebaseUid: "firebase_01",
  locale: "vi",
  identities: [],
} as const;

const profile = {
  fullName: "An Nguyễn",
  dateOfBirth: null,
  nationality: null,
  formOfAddress: null,
  locale: "vi",
  primaryEmail: null,
  primaryPhone: "+84901234567",
  providerMetadata: [],
} as const;

describe("AccountProfilePage", () => {
  beforeEach(() => {
    ports.getAuthenticatedAccount.mockReset();
    ports.getProfile.mockReset();
  });

  it("renders a neutral unavailable state for anonymous access", async () => {
    // Given: no verified account session.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: the profile page renders.
    render(await AccountProfilePage());

    // Then: it does not reveal provider details.
    expect(screen.getByText("Thông tin hồ sơ hiện chưa khả dụng.")).toBeInTheDocument();
    expect(ports.getProfile).not.toHaveBeenCalled();
  });

  it("renders the profile form for an authenticated account", async () => {
    // Given: a verified account and its profile presentation model.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.getProfile.mockResolvedValue(profile);

    // When: the profile page renders.
    render(await AccountProfilePage());

    // Then: it presents the editable profile surface.
    expect(screen.getByText("Profile form")).toBeInTheDocument();
    expect(ports.getProfile).toHaveBeenCalledWith(account);
  });
});
