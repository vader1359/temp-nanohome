import { AccountOfferList, AccountOffersUnavailable } from "@/components/account/account-offer-list";
import { getAccountAuthPort, getAccountOffersPort } from "@/lib/account/account-ports.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type AccountOffersPageProps = Readonly<{ params: Promise<Readonly<{ locale: string }>> }>;

export default async function AccountOffersPage({ params }: AccountOffersPageProps) {
  await params;
  const t = await getTranslations("Account");
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return <AccountOffersUnavailable />;
  const offers = await getAccountOffersPort().listOffers(account);
  return <section aria-labelledby="account-offers-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-offers-title">{t("offers.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("offers.description")}</p><AccountOfferList offers={offers} /></section>;
}
