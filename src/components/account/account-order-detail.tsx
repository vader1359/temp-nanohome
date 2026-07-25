import type { AccountOrder } from "@/lib/account/orders-port";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
}

function formatTotal(order: AccountOrder): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: order.total.currency }).format(order.total.amount);
}

export function AccountOrderDetail({ order }: Readonly<{ order: AccountOrder }>) {
  return <article aria-labelledby="account-order-title"><p className="text-sm text-[var(--nh-muted)]">Chi tiết đơn hàng</p><h2 className="mt-2 text-xl font-semibold text-[var(--nh-ink)]" id="account-order-title">Đơn {order.orderNumber}</h2><dl className="mt-8 grid gap-4 border-y border-[var(--nh-border)] py-5 text-sm sm:grid-cols-3"><div><dt className="text-[var(--nh-muted)]">Ngày đặt</dt><dd className="mt-1 text-[var(--nh-ink)]"><time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time></dd></div><div><dt className="text-[var(--nh-muted)]">Trạng thái</dt><dd className="mt-1 text-[var(--nh-ink)]">{order.status === "fulfilled" ? "Đã hoàn tất" : "Đã thanh toán"}</dd></div><div><dt className="text-[var(--nh-muted)]">Tổng cộng</dt><dd className="mt-1 text-[var(--nh-ink)]">{formatTotal(order)}</dd></div></dl></article>;
}

export function AccountOrderUnavailable() {
  return <section aria-labelledby="account-order-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-order-title">Đơn hàng</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Thông tin đơn hàng hiện chưa khả dụng.</p></section>;
}
