import { CheckoutPage } from "@/components/checkout/checkout-page";
import { getAccountCartPort, getAccountProfilePort } from "@/lib/account/account-ports.server";
import { requireAuthenticatedAccount } from "@/lib/account/require-account.server";
import { resolveCheckoutIdentity } from "@/lib/checkout/checkout-identity";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CheckoutRoute({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const account = await requireAuthenticatedAccount(
    locale,
    `/${locale}/checkout`,
    { requireCheckoutIdentity: true },
  );
  const identity = resolveCheckoutIdentity(account);
  if (identity.kind === "identity_required") {
    redirect(
      `/${locale}/account/sign-in?returnTo=${encodeURIComponent(`/${locale}/checkout`)}&intent=checkout`,
    );
  }
  const [cart, profile] = await Promise.all([
    getAccountCartPort().getCart(account),
    getAccountProfilePort().getProfile(account),
  ]);
  return (
    <CheckoutPage
      checkoutIdentity={identity.identity}
      initialAccountCart={cart}
      initialFullName={profile.fullName ?? ""}
      locale={locale}
    />
  );
}
