import { AccountOrderList } from "@/components/account/account-order-list";
import { getAccountOrdersPort } from "@/lib/account/account-ports.server";
import { requireAuthenticatedAccount } from "@/lib/account/require-account.server";

export const dynamic = "force-dynamic";

type OrdersPageProps = Readonly<{ params: Promise<Readonly<{ locale: string }>>; searchParams: Promise<Readonly<{ after?: string }>> }>;

export default async function AccountOrdersPage({ params, searchParams }: OrdersPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const account = await requireAuthenticatedAccount(locale, `/${locale}/account/orders`);
  const page = await getAccountOrdersPort().listOrders(account, { cursor: query.after ?? null, limit: 20 });
  return <AccountOrderList locale={locale} nextCursor={page.nextCursor} orders={page.orders} />;
}
