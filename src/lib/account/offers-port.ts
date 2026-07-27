import "server-only";

import type { AuthenticatedAccount } from "./auth-port";

export type AccountOfferStatus = "active" | "expired" | "used";
export type AccountOffer = Readonly<{
  readonly title: string;
  readonly code: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly eligibleScope: string;
  readonly minimumAmount: Readonly<{ readonly amount: number; readonly currency: string }> | null;
  readonly combinationRule: string;
  readonly remainingUses: number;
  readonly status: AccountOfferStatus;
}>;
export type AccountOfferSeed = Readonly<{ readonly accountId: string; readonly audience: boolean; readonly offer: AccountOffer }>;
export interface AccountOffersPort { readonly listOffers: (account: AuthenticatedAccount) => Promise<readonly AccountOffer[]>; }

export function createFakeAccountOffersPort(seeds: readonly AccountOfferSeed[] = []): AccountOffersPort {
  return { listOffers: async (account) => seeds.filter((seed) => seed.accountId === account.accountId && seed.audience).map((seed) => ({ ...seed.offer, minimumAmount: seed.offer.minimumAmount === null ? null : { ...seed.offer.minimumAmount } })) };
}
