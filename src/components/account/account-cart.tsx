"use client";

import { useRef, useState } from "react";
import type { AccountCart as Cart } from "@/lib/account/cart-port";
import { useCart } from "@/components/cart/cart-context";

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
  const { clearCart, items } = useCart();
  const mergeIdempotencyKeyRef = useRef<string | null>(null);

  async function mutate(method: "PATCH" | "DELETE", variantId: string, quantity?: number) {
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
    }
    setCart(cart);
    setMessage("Không thể cập nhật giỏ hàng.");
  }

  async function mergeGuest() {
    const selection = items.map(({ id, quantity }) => ({ quantity, variantId: id }));
    if (selection.length === 0) return;
    if (mergeIdempotencyKeyRef.current === null) {
      mergeIdempotencyKeyRef.current = crypto.randomUUID();
    }
    const idempotencyKey = mergeIdempotencyKeyRef.current;
    try {
      const response = await fetch("/api/account/cart/merge-guest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey, items: selection }),
      });
      const body: unknown = await response.json();
      if (response.ok && isCartResponse(body)) {
        setCart(body.cart);
        clearCart();
        mergeIdempotencyKeyRef.current = null;
        const summary = body.cart.mergeSummary;
        setMessage(
          summary === undefined
            ? "Đã nhập giỏ hàng khách."
            : `Đã nhập giỏ hàng khách: ${summary.changedLines} dòng thay đổi, ${summary.removedLines} dòng không còn khả dụng.`,
        );
        return;
      }
    } catch {
      // Cleanly catch network errors
    }
    setMessage("Không thể nhập giỏ hàng khách.");
  }

  return (
    <div className="mt-6">
      <p aria-live="polite" className="text-sm text-[var(--nh-muted)]">
        {message}
      </p>
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
                disabled={!item.available}
                max="10"
                min="1"
                onChange={(event) => mutate("PATCH", item.variantId, Number(event.target.value))}
                type="number"
                value={item.quantity}
              />
            </label>
            <button
              className="min-h-11 px-3 text-sm text-[var(--nh-red)]"
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
      {cart.items.some((item) => item.available) ? (
        <a
          className="mt-4 inline-flex min-h-11 items-center bg-[var(--nh-ink)] px-5 text-sm text-white"
          href={checkoutHref}
        >
          Tiếp tục thanh toán
        </a>
      ) : null}
      <button
        className="ml-3 mt-4 min-h-11 border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)]"
        onClick={mergeGuest}
        type="button"
      >
        Nhập giỏ hàng khách
      </button>
    </div>
  );
}
