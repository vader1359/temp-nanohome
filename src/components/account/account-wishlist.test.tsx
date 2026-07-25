import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountWishlist } from "./account-wishlist";

const items = [
  { availability: "available", href: "/vi/products/variant-01", title: "Ghế thư giãn", variantId: "variant-01" },
  { availability: "unavailable", href: "/vi/products/variant-02", title: "Đèn bàn", variantId: "variant-02" },
] as const;

describe("AccountWishlist", () => {
  it("identifies unavailable saved items and keeps each item removable", () => {
    // Given: an available and an unavailable Account wishlist item.
    render(<AccountWishlist initialItems={items} />);

    // When: the saved items are displayed.
    // Then: availability is identifiable and each removal action is accessible.
    expect(screen.getByText("Không còn khả dụng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa Ghế thư giãn khỏi danh sách yêu thích" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Xóa Đèn bàn khỏi danh sách yêu thích" })).toHaveClass("min-h-11");
  });

  it("rolls an optimistic removal back when the private API fails", async () => {
    // Given: a saved item and a failing private mutation.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    render(<AccountWishlist initialItems={[items[0]]} />);

    // When: the user removes the item.
    fireEvent.click(screen.getByRole("button", { name: "Xóa Ghế thư giãn khỏi danh sách yêu thích" }));

    // Then: the optimistic removal rolls back and exposes an announced error.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể cập nhật danh sách yêu thích."));
    expect(screen.getByText("Ghế thư giãn")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("rolls an optimistic removal back when the private request rejects", async () => {
    // Given: a saved item and an interrupted private mutation.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network interrupted"));
    render(<AccountWishlist initialItems={[items[0]]} />);

    // When: the user removes the item.
    fireEvent.click(screen.getByRole("button", { name: "Xóa Ghế thư giãn khỏi danh sách yêu thích" }));

    // Then: the optimistic removal restores the saved item and announces the failure.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể cập nhật danh sách yêu thích."));
    expect(screen.getByText("Ghế thư giãn")).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
