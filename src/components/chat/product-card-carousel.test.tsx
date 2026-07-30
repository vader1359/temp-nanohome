import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductGridItem } from "@/components/products/product-grid-item";

const { productCardSpy } = vi.hoisted(() => ({ productCardSpy: vi.fn() }));

vi.mock("@/components/products/product-card", () => ({
  ProductCard: (props: Readonly<{
    product: ProductGridItem;
    isFavorite: boolean;
    onToggleFavorite: () => void;
  }>) => {
    productCardSpy(props.product);
    return (
      <article data-testid="shared-product-card">
        <button aria-label={`Toggle ${props.product.name}`} onClick={props.onToggleFavorite} type="button" />
        <a href={props.product.href} onClick={(event) => event.preventDefault()}>{props.product.name}</a>
      </article>
    );
  },
}));

import { ProductCardCarousel, type ProductCardCarouselTelemetry } from "./product-card-carousel";

const product = (id: string): ProductGridItem => ({
  id,
  brand: "Brand",
  brandLogoUrl: null,
  name: `Product ${id}`,
  subtitle: "Collection",
  status: "unknown",
  imageUrl: `/images/${id}.webp`,
  imageAlt: `Image ${id}`,
  href: `/vi/products/${id}`,
  oldPrice: null,
  discount: null,
  price: "Liên hệ",
  swatches: [],
});

beforeEach(() => {
  productCardSpy.mockClear();
  Object.defineProperties(HTMLElement.prototype, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 400 },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollBy", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { width: this.classList.contains("snap-start") ? 100 : 200 } as DOMRect;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() { this.callback([], this as unknown as ResizeObserver); }
    disconnect() {}
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ProductCardCarousel", () => {
  it("renders every eligible item through the shared ProductCard and exposes a named region", () => {
    render(
      <ProductCardCarousel
        countLabel="2 items"
        isFavorite={() => false}
        label="Verified products"
        locale="en"
        next="Next"
        onToggleFavorite={vi.fn()}
        previous="Previous"
        products={[product("one"), product("two")]}
      />,
    );

    expect(new Set(productCardSpy.mock.calls.map(([item]) => item.id))).toEqual(new Set(["one", "two"]));
    expect(screen.getAllByTestId("shared-product-card")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Verified products" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("moves one card, records safe interactions, and omits arrows for one item", () => {
    const telemetry: ProductCardCarouselTelemetry[] = [];
    const toggle = vi.fn();
    const { unmount } = render(
      <ProductCardCarousel
        countLabel="2 items"
        isFavorite={(id) => id === "one"}
        label="Verified products"
        locale="en"
        next="Next"
        onTelemetry={(event) => telemetry.push(event)}
        onToggleFavorite={toggle}
        previous="Previous"
        products={[product("one"), product("two")]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(HTMLElement.prototype.scrollBy).toHaveBeenCalledWith({ left: 112, behavior: "smooth" });
    fireEvent.click(screen.getByRole("button", { name: "Toggle Product one" }));
    fireEvent.click(screen.getByRole("link", { name: "Product one" }));
    expect(toggle).toHaveBeenCalledWith(expect.objectContaining({ id: "one" }));
    expect(telemetry).toEqual(expect.arrayContaining([
      { type: "rendered", eligibleCount: 2, skippedCount: 0 },
      { type: "wishlist_toggled", variantId: "one", position: 0, action: "removed" },
      { type: "detail_clicked", variantId: "one", position: 0 },
    ]));

    unmount();
    render(
      <ProductCardCarousel
        countLabel="1 item"
        isFavorite={() => false}
        label="One product"
        locale="en"
        next="Next"
        onToggleFavorite={vi.fn()}
        previous="Previous"
        products={[product("only")]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
  });
});
