import type { AccountOrder } from "@/lib/account/orders-port";
import { useTranslations } from "next-intl";

const statusKeys = {
  cancelled: "orders.statusCancelled",
  expired: "orders.statusExpired",
  failed: "orders.statusFailed",
  fulfilled: "orders.statusFulfilled",
  paid: "orders.statusPaid",
  pending: "orders.statusPending",
  refunded: "orders.statusRefunded",
} as const;

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

function formatTotal(order: AccountOrder, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: order.total.currency }).format(order.total.amount);
}

export function AccountOrderList({ orders, nextCursor, locale }: Readonly<{ orders: readonly AccountOrder[]; nextCursor: string | null; locale: string }>) {
  const t = useTranslations("Account");
  return (
    <section aria-labelledby="account-orders-title">
      <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-orders-title">{t("orders.title")}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("orders.description")}</p>
      {orders.length === 0 ? <p className="mt-8 border-t border-[var(--nh-border)] pt-6 text-sm text-[var(--nh-muted)]">{t("orders.empty")}</p> : (
        <ul className="mt-8 divide-y divide-[var(--nh-border)] border-y border-[var(--nh-border)]" aria-label={t("orders.listLabel")}>
          {orders.map((order) => <li key={order.orderId} className="py-4 first:pt-5 last:pb-5">
            <a className="grid gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--nh-accent)] sm:grid-cols-[1fr_auto] sm:items-center" href={`/${locale}/account/orders/${encodeURIComponent(order.orderId)}`}>
              <span><span className="font-medium text-[var(--nh-ink)]">{t("orders.orderPrefix")} {order.orderNumber}</span><span className="mt-1 block text-[var(--nh-muted)]"><time dateTime={order.placedAt}>{formatDate(order.placedAt, locale)}</time> · {t(statusKeys[order.status])}</span></span>
              <span className="text-[var(--nh-ink)]">{formatTotal(order, locale)}</span>
            </a>
          </li>)}
        </ul>
      )}
      {nextCursor === null ? null : <a className="mt-6 inline-flex min-h-11 items-center border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]" href={`/${locale}/account/orders?after=${encodeURIComponent(nextCursor)}`}>{t("orders.loadMoreCta")}</a>}
    </section>
  );
}

export function AccountOrdersUnavailable() {
  const t = useTranslations("Account");
  return <section aria-labelledby="account-orders-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-orders-title">{t("orders.title")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("orders.unavailable")}</p></section>;
}
