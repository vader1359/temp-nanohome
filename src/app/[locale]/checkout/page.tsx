import { CheckoutPage } from "@/components/checkout/checkout-page";
import { getAccountCartPort } from "@/lib/account/account-ports.server";
import { requireAuthenticatedAccount } from "@/lib/account/require-account.server";

export const dynamic = "force-dynamic";

export default async function CheckoutRoute({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const account = await requireAuthenticatedAccount(locale, `/${locale}/checkout`);
  const cart = await getAccountCartPort().getCart(account);
  return <CheckoutPage initialAccountCart={cart} />;
}
