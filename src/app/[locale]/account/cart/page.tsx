import { AccountCart } from "@/components/account/account-cart";
import { getAccountAuthPort, getAccountCartPort } from "@/lib/account/account-ports.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
type Props = Readonly<{ params: Promise<{ locale: string }> }>;
export default async function AccountCartPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Account");
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return <section aria-labelledby="account-cart-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-cart-title">{t("cart.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("cart.unavailable")}</p></section>;
  const cart = await getAccountCartPort().getCart(account);
  if (cart.items.length === 0) return <section aria-labelledby="account-cart-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-cart-title">{t("cart.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("cart.empty")}</p><a className="mt-6 inline-flex min-h-11 items-center border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)]" href={`/${locale}/products`}>{t("cart.exploreCta")}</a></section>;
  return <section aria-labelledby="account-cart-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-cart-title">{t("cart.title")}</h2><AccountCart initialCart={cart} /></section>;
}
