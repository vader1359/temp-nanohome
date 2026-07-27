import { AccountOrderDetail, AccountOrderUnavailable } from "@/components/account/account-order-detail";
import { getAccountAuthPort, getAccountOrdersPort } from "@/lib/account/account-ports.server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type OrderPageProps = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export default async function AccountOrderPage({ params }: OrderPageProps) {
  const { orderId } = await params;
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return <AccountOrderUnavailable />;
  const order = await getAccountOrdersPort().getOrder(account, orderId);
  if (order === null) notFound();
  return <AccountOrderDetail order={order} />;
}

