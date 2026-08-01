"use client";

import { useEffect, useState } from "react";
import type { AccountCart as Cart } from "@/lib/account/cart-port";
import { useCart } from "@/components/cart/cart-context";
import { cartCheckoutReadiness } from "@/lib/checkout/cart-readiness";

function isCartResponse(value: unknown): value is Readonly<{ readonly cart: Cart }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "cart" in value &&
    typeof value.cart === "object" &&
    value.cart !== null
  );
}

export function AccountCart({
  checkoutHref,
  initialCart,
}: Readonly<{ checkoutHref: string; initialCart: Cart }>) {
  const [cart, setCart] = useState(initialCart);
  const [message, setMessage] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const { reconcileAccountCart } = useCart();
  const readiness = cartCheckoutReadiness(cart);

  useEffect(() => {
    reconcileAccountCart(initialCart);
  }, [initialCart, reconcileAccountCart]);

  async function mutate(method: "PATCH" | "DELETE", variantId: string, quantity?: number) {
    if (isMutating) return;
    const previousCart = cart;
    const optimistic =
      method === "DELETE"
        ? { ...cart, items: cart.items.filter((item) => item.variantId !== variantId) }
        : {
            ...cart,
            items: cart.items.map((item) =>
              item.variantId === variantId ? { ...item, quantity: quantity ?? item.quantity } : item,
            ),
          };
    setCart(optimistic);
    setIsMutating(true);
    try {
      const response = await fetch("/api/account/cart", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          method === "DELETE"
            ? { expectedVersion: cart.version, variantId }
            : { expectedVersion: cart.version, quantity, variantId },
        ),
      });
      const body: unknown = await response.json();
      if ((response.ok || response.status === 409 || response.status === 422) && isCartResponse(body)) {
        setCart(body.cart);
        reconcileAccountCart(body.cart);
        setMessage(
          response.status === 409
            ? "Giỏ hàng đã thay đổi. Vui lòng thử lại thao tác."
            : response.status === 422
              ? "Sản phẩm không còn đủ điều kiện hoặc số lượng tồn kho đã thay đổi."
            : "Đã cập nhật giỏ hàng.",
        );
        return;
      }
    } catch {
      // Cleanly catch network errors
    } finally {
      setIsMutating(false);
    }
    setCart(previousCart);
    setMessage("Không thể cập nhật giỏ hàng.");
  }

  return (
    <div className="mt-6">
      <p aria-live="polite" className="text-sm text-[var(--nh-muted)]">
        {message}
      </p>
      {readiness.kind === "unavailable_items" ? (
        <div
          aria-live="polite"
          className="mt-4 border border-[var(--nh-red)] bg-[var(--nh-surface-warm)] p-4 text-sm text-[var(--nh-ink)]"
          role="alert"
        >
          <p className="font-medium">Không thể thanh toán khi giỏ còn sản phẩm không khả dụng.</p>
          <p className="mt-1 text-[var(--nh-muted)]">
            Hãy xóa hoặc điều chỉnh các dòng được đánh dấu rồi thử lại.
          </p>
          <ul className="mt-2 list-disc pl-5 text-[var(--nh-muted)]">
            {readiness.unavailableItems.map((item) => (
              <li key={item.variantId}>
                {item.title} ({item.quantity})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {readiness.kind === "stock_changed" ? (
        <div
          aria-live="polite"
          className="mt-4 border border-[var(--nh-red)] bg-[var(--nh-surface-warm)] p-4 text-sm text-[var(--nh-ink)]"
          role="alert"
        >
          <p className="font-medium">Số lượng tồn kho đã thay đổi.</p>
          <p className="mt-1 text-[var(--nh-muted)]">Hãy kiểm tra và điều chỉnh các dòng được đánh dấu trước khi thanh toán.</p>
          <ul className="mt-2 list-disc pl-5 text-[var(--nh-muted)]">
            {readiness.changedItems.map((item) => <li key={item.variantId}>{item.title} ({item.quantity})</li>)}
          </ul>
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-[var(--nh-border)]">
        {cart.items.map((item) => (
          <li className="flex items-center justify-between gap-4 py-4" key={item.variantId}>
            <span className="text-sm text-[var(--nh-ink)]">
              {item.title}
              {!item.available ? (
                <span className="ml-2 text-xs text-[var(--nh-red)]">Không còn khả dụng</span>
              ) : null}
            </span>
            <label className="text-sm text-[var(--nh-muted)]">
              Số lượng
              <input
                aria-label={`Số lượng ${item.title}`}
                className="ml-2 min-h-11 w-16 border border-[var(--nh-border)] text-center"
                disabled={!item.available || isMutating}
                max="10"
                min="1"
                onChange={(event) => mutate("PATCH", item.variantId, Number(event.target.value))}
                type="number"
                value={item.quantity}
              />
            </label>
            <button
              className="min-h-11 px-3 text-sm text-[var(--nh-red)]"
              disabled={isMutating}
              onClick={() => mutate("DELETE", item.variantId)}
              type="button"
            >
              Xóa
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm font-medium text-[var(--nh-ink)]">
        Tổng cộng: {cart.total.amount.toLocaleString("vi-VN")} {cart.total.currency}
      </p>
      {readiness.kind === "ready" && !isMutating ? (
        <a
          className="mt-4 inline-flex min-h-11 items-center bg-[var(--nh-ink)] px-5 text-sm text-white"
          href={checkoutHref}
        >
          Tiếp tục thanh toán
        </a>
      ) : null}
      {isMutating ? (
        <p aria-live="polite" className="mt-4 text-sm text-[var(--nh-muted)]">
          Đang đồng bộ giỏ hàng...
        </p>
      ) : null}
    </div>
  );
}
