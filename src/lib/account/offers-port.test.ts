import { describe, expect, it } from "vitest";

import { createFakeAccountOffersPort, type AccountOfferSeed } from "./offers-port";

const account = { accountId: "account_01", firebaseUid: "firebase_01", locale: "vi", identities: [] } as const;
const otherAccount = { ...account, accountId: "account_02" } as const;
const seeds = [
  { accountId: "account_01", audience: true, offer: { title: "Mùa hè", code: "SUMMER", validFrom: "2026-06-01", validUntil: "2026-08-31", eligibleScope: "Danh mục ghế", minimumAmount: { amount: 1000000, currency: "VND" }, combinationRule: "Không cộng dồn", remainingUses: 2, status: "active" } },
  { accountId: "account_02", audience: true, offer: { title: "Riêng tư", code: "OTHER", validFrom: "2026-06-01", validUntil: "2026-08-31", eligibleScope: "Danh mục bàn", minimumAmount: null, combinationRule: "Không cộng dồn", remainingUses: 1, status: "active" } },
  { accountId: "account_01", audience: false, offer: { title: "Ẩn", code: "HIDDEN", validFrom: "2026-06-01", validUntil: "2026-08-31", eligibleScope: "Tất cả sản phẩm", minimumAmount: null, combinationRule: "Có thể cộng dồn", remainingUses: 1, status: "active" } },
] satisfies readonly AccountOfferSeed[];

describe("createFakeAccountOffersPort", () => {
  it("filters by account audience and returns public terms only", async () => {
    // Given: eligible and ineligible offers for multiple accounts.
    const port = createFakeAccountOffersPort(seeds);
    // When: one account reads its offers.
    const offers = await port.listOffers(account);
    // Then: only its public offer projection is returned.
    expect(offers).toEqual([seeds[0].offer]);
  });

  it("does not expose another account's offers", async () => {
    // Given: offers assigned to a different account.
    const port = createFakeAccountOffersPort(seeds);
    // When: the other account reads its offers.
    const offers = await port.listOffers(otherAccount);
    // Then: only the other account's offer is visible.
    expect(offers).toEqual([seeds[1].offer]);
  });
});
