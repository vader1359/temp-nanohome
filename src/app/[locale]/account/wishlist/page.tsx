import { AccountWishlist } from "@/components/account/account-wishlist";
import { getAccountAuthPort, getAccountWishlistPort } from "@/lib/account/account-ports.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type AccountWishlistPageProps = Readonly<{ params: Promise<Readonly<{ locale: string }>> }>;

export default async function AccountWishlistPage({ params }: AccountWishlistPageProps) {
  const { locale } = await params;
  const t = await getTranslations("Account");
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) {
    return <section aria-labelledby="account-wishlist-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-wishlist-title">{t("wishlist.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("wishlist.unavailable")}</p></section>;
  }
  const items = await getAccountWishlistPort().getItems(account);
  if (items.length === 0) {
    return <section aria-labelledby="account-wishlist-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-wishlist-title">{t("wishlist.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("wishlist.empty")}</p><a className="mt-6 inline-flex min-h-11 items-center border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]" href={`/${locale}/products`}>{t("wishlist.exploreCta")}</a></section>;
  }
  return <section aria-labelledby="account-wishlist-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-wishlist-title">{t("wishlist.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("wishlist.description")}</p><AccountWishlist initialItems={items} /></section>;
}
