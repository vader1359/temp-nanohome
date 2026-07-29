import { AccountOrderDetail } from "@/components/account/account-order-detail";
import { getAccountOrdersPort } from "@/lib/account/account-ports.server";
import { requireAuthenticatedAccount } from "@/lib/account/require-account.server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type OrderPageProps = Readonly<{ params: Promise<Readonly<{ locale: string; orderId: string }>> }>;

export default async function AccountOrderPage({ params }: OrderPageProps) {
  const { locale, orderId } = await params;
  const account = await requireAuthenticatedAccount(locale, `/${locale}/account/orders/${encodeURIComponent(orderId)}`);
  const order = await getAccountOrdersPort().getOrder(account, orderId);
  if (order === null) notFound();
  return <AccountOrderDetail order={order} />;
}
