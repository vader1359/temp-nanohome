import { AccountOrderList, AccountOrdersUnavailable } from "@/components/account/account-order-list";
import { getAccountAuthPort, getAccountOrdersPort } from "@/lib/account/account-ports.server";

export const dynamic = "force-dynamic";

type OrdersPageProps = Readonly<{ params: Promise<Readonly<{ locale: string }>>; searchParams: Promise<Readonly<{ after?: string }>> }>;

export default async function AccountOrdersPage({ params, searchParams }: OrdersPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account === null) return <AccountOrdersUnavailable />;
  const page = await getAccountOrdersPort().listOrders(account, { cursor: query.after ?? null, limit: 20 });
  return <AccountOrderList locale={locale} nextCursor={page.nextCursor} orders={page.orders} />;
}
