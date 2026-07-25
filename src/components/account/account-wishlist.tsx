"use client";

import { useState } from "react";

import type { AccountWishlistItem } from "@/lib/account/wishlist-port";

export function AccountWishlist({ initialItems }: Readonly<{ initialItems: readonly AccountWishlistItem[] }>) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState("");

  async function removeItem(item: AccountWishlistItem) {
    setError("");
    setItems((currentItems) => currentItems.filter((currentItem) => currentItem.variantId !== item.variantId));
    try {
      const response = await fetch("/api/account/wishlist", {
        body: JSON.stringify({ variantId: item.variantId }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      if (response.ok) return;
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;
    }
    setItems((currentItems) => [...currentItems, item].sort((left, right) => left.variantId.localeCompare(right.variantId)));
    setError("Không thể cập nhật danh sách yêu thích.");
  }

  if (items.length === 0) {
    return <p className="mt-8 border-t border-[var(--nh-border)] pt-6 text-sm leading-6 text-[var(--nh-muted)]">Chưa có sản phẩm yêu thích.</p>;
  }

  return (
    <>
      <ul aria-label="Danh sách yêu thích" className="mt-8 divide-y divide-[var(--nh-border)] border-y border-[var(--nh-border)]">
        {items.map((item) => (
          <li className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between" key={item.variantId}>
            <div className="grid gap-1">
              <a className="text-sm font-medium text-[var(--nh-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--nh-accent)]" href={item.href}>{item.title}</a>
              {item.availability === "unavailable" ? <span className="text-sm text-[var(--nh-red)]">Không còn khả dụng</span> : null}
            </div>
            <button className="min-h-11 w-fit border border-[var(--nh-border)] px-4 text-sm text-[var(--nh-ink)] transition-colors hover:border-[var(--nh-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nh-accent)]" onClick={() => removeItem(item)} type="button">Xóa<span className="sr-only"> {item.title} khỏi danh sách yêu thích</span></button>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-4 text-sm text-[var(--nh-red)]" role="alert">{error}</p> : null}
    </>
  );
}
