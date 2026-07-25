import type { AccountOrder } from "@/lib/account/orders-port";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
}

function formatTotal(order: AccountOrder): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: order.total.currency }).format(order.total.amount);
}

export function AccountOrderList({ orders, nextCursor, locale }: Readonly<{ orders: readonly AccountOrder[]; nextCursor: string | null; locale: string }>) {
  return (
    <section aria-labelledby="account-orders-title">
      <h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-orders-title">Đơn hàng của tôi</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Lịch sử các đơn hàng đã đặt.</p>
      {orders.length === 0 ? <p className="mt-8 border-t border-[var(--nh-border)] pt-6 text-sm text-[var(--nh-muted)]">Chưa có đơn hàng.</p> : (
        <ul className="mt-8 divide-y divide-[var(--nh-border)] border-y border-[var(--nh-border)]" aria-label="Danh sách đơn hàng">
          {orders.map((order) => <li key={order.orderId} className="py-4 first:pt-5 last:pb-5">
            <a className="grid gap-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--nh-accent)] sm:grid-cols-[1fr_auto] sm:items-center" href={`/${locale}/account/orders/${encodeURIComponent(order.orderId)}`}>
              <span><span className="font-medium text-[var(--nh-ink)]">Đơn {order.orderNumber}</span><span className="mt-1 block text-[var(--nh-muted)]"><time dateTime={order.placedAt}>{formatDate(order.placedAt)}</time> · {order.status === "fulfilled" ? "Đã hoàn tất" : "Đã thanh toán"}</span></span>
              <span className="text-[var(--nh-ink)]">{formatTotal(order)}</span>
            </a>
          </li>)}
        </ul>
      )}
      {nextCursor === null ? null : <a className="mt-6 inline-flex min-h-11 items-center border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]" href={`/${locale}/account/orders?after=${encodeURIComponent(nextCursor)}`}>Xem đơn cũ hơn</a>}
    </section>
  );
}

export function AccountOrdersUnavailable() {
  return <section aria-labelledby="account-orders-title"><h2 className="text-xl font-semibold text-[var(--nh-ink)]" id="account-orders-title">Đơn hàng của tôi</h2><p className="mt-3 text-sm leading-6 text-[var(--nh-muted)]">Thông tin đơn hàng hiện chưa khả dụng.</p></section>;
}
