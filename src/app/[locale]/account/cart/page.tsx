import { AccountCart } from "@/components/account/account-cart";
import { getAccountCartPort } from "@/lib/account/account-ports.server";
import { requireAuthenticatedAccount } from "@/lib/account/require-account.server";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
type Props = Readonly<{ params: Promise<{ locale: string }> }>;
export default async function AccountCartPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Account");
  const account = await requireAuthenticatedAccount(locale, `/${locale}/account/cart`);
  const cart = await getAccountCartPort().getCart(account);
  return <section aria-labelledby="account-cart-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-cart-title">{t("cart.title")}</h2><AccountCart checkoutHref={`/${locale}/checkout`} initialCart={cart} /></section>;
}
