import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), listOffers: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({ getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }), getAccountOffersPort: () => ({ listOffers: ports.listOffers }) }));
import AccountOffersPage from "./page";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;

describe("AccountOffersPage", () => {
  beforeEach(() => { ports.getAuthenticatedAccount.mockReset(); ports.listOffers.mockReset(); });
  it("does not access offers for anonymous access", async () => {
    // Given: no authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(null);
    // When: the offers page renders.
    render(await AccountOffersPage({ params: Promise.resolve({ locale: "vi" }) }));
    // Then: it stays neutral and avoids the private port.
    expect(screen.getByText("Thông tin ưu đãi hiện chưa khả dụng.")).toBeInTheDocument();
    expect(ports.listOffers).not.toHaveBeenCalled();
  });
  it("renders account-owned offers", async () => {
    // Given: an authenticated account and its offer projection.
    ports.getAuthenticatedAccount.mockResolvedValue(account);
    ports.listOffers.mockResolvedValue([{ title: "Mùa hè", code: "SUMMER", validFrom: "2026-06-01", validUntil: "2026-08-31", eligibleScope: "Danh mục ghế", minimumAmount: null, combinationRule: "Không cộng dồn", remainingUses: 1, status: "active" }]);
    // When: the offers page renders.
    render(await AccountOffersPage({ params: Promise.resolve({ locale: "vi" }) }));
    // Then: the account-scoped terms are shown.
    expect(screen.getByRole("heading", { name: "Mùa hè" })).toBeInTheDocument();
    expect(ports.listOffers).toHaveBeenCalledWith(account);
  });
});
