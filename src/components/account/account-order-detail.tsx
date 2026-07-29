import type { AccountOrder } from "@/lib/account/orders-port";
import { useLocale, useTranslations } from "next-intl";

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

export function AccountOrderDetail({ order }: Readonly<{ order: AccountOrder }>) {
  const locale = useLocale();
  const t = useTranslations("Account");
  return <article aria-labelledby="account-order-title"><p className="text-sm text-[var(--nh-muted)]">{t("orders.detailLabel")}</p><h2 className="mt-2 text-xl font-semibold text-[var(--nh-ink)]" id="account-order-title">{t("orders.orderPrefix")} {order.orderNumber}</h2><dl className="mt-8 grid gap-4 border-y border-[var(--nh-border)] py-5 text-sm sm:grid-cols-3"><div><dt className="text-[var(--nh-muted)]">{t("orders.dateLabel")}</dt><dd className="mt-1 text-[var(--nh-ink)]"><time dateTime={order.placedAt}>{formatDate(order.placedAt, locale)}</time></dd></div><div><dt className="text-[var(--nh-muted)]">{t("orders.statusLabel")}</dt><dd className="mt-1 text-[var(--nh-ink)]">{t(statusKeys[order.status])}</dd></div><div><dt className="text-[var(--nh-muted)]">{t("orders.totalLabel")}</dt><dd className="mt-1 text-[var(--nh-ink)]">{formatTotal(order, locale)}</dd></div></dl>{order.items.length === 0 ? null : <section className="mt-8" aria-labelledby="account-order-items"><h3 className="text-base font-medium text-[var(--nh-ink)]" id="account-order-items">{t("orders.itemsLabel")}</h3><ul className="mt-4 divide-y divide-[var(--nh-border)] border-y border-[var(--nh-border)]">{order.items.map((item, index) => <li className="flex justify-between gap-4 py-4 text-sm" key={`${item.sku ?? item.productName}-${index}`}><span className="text-[var(--nh-ink)]">{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</span><span className="text-[var(--nh-muted)]">{t("orders.quantityLabel", { count: item.quantity })}</span></li>)}</ul></section>}</article>;
}

export function AccountOrderUnavailable() {
  const t = useTranslations("Account");
  return <section aria-labelledby="account-order-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-order-title">{t("orders.orderTitle")}</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">{t("orders.unavailable")}</p></section>;
}
