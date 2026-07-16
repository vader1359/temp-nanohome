import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HomepageCmsSection } from "@/lib/queries/homepage-cms";
import type { VariantProductListItem } from "@/lib/queries/products";
import { WishlistProvider } from "@/components/wishlist/wishlist-context";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { readonly alt: string; readonly src: string }) => <img alt={alt} src={src} />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { readonly children: React.ReactNode; readonly href: string }) => <a href={href}>{children}</a>,
}));

import { CmsContentCarousel, CmsProductCuration } from "./cms-sections";

const product = (id: string, name: string): VariantProductListItem => ({
  id, name, name_vi: name, name_ko: null, short_name: null, short_name_vi: null, short_name_ko: null,
  slug: id, slug_vi: id, slug_ko: id, sku: id, stock: 4, price: 100, compare_at_price: null,
  discount_percent: null, on_sale: false, in_stock: true, packshot_url: `/images/${id}.webp`, gallery_urls: [],
  finish: null, finish_vi: null, finish_ko: null, size: null, product_id: id, brand_id: null, designer_id: null,
  brand_cldr_logo: null, brand_name_denorm: "Brand", category_id: null, filter_brand: null, filter_category: null,
  filter_room: null, filter_room_vi: null, filter_room_ko: null, media_lifestyle_1: null, media_lifestyle_2: null,
  cldr_media_lifestyle_1: null, cldr_media_lifestyle_2: null, media_long: null, media_closeup: null,
  filter_sub_category: null, filter_is_new_arrival: false,
});

function renderWithWishlist(ui: React.ReactNode) {
  return render(<WishlistProvider>{ui}</WishlistProvider>);
}

describe("CMS homepage sections", () => {
  it("renders nothing for empty or incomplete sections", () => {
    const emptyCuration: Extract<HomepageCmsSection, { readonly type: "product_curation" }> = { type: "product_curation", title: "Empty", items: [] };
    const emptyCarousel: Extract<HomepageCmsSection, { readonly type: "content_carousel" }> = { type: "content_carousel", title: "Empty", items: [] };

    renderWithWishlist(<><CmsProductCuration section={emptyCuration} /><CmsContentCarousel section={emptyCarousel} /></>);

    expect(screen.queryByText("Empty")).not.toBeInTheDocument();
  });

  it("preserves curation product order", () => {
    const section: Extract<HomepageCmsSection, { readonly type: "product_curation" }> = {
      type: "product_curation", title: "Selected", items: [product("one", "First"), product("two", "Second")],
    };

    renderWithWishlist(<CmsProductCuration section={section} />);

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First").compareDocumentPosition(screen.getByText("Second")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders carousel images and only safe local relative links", () => {
    const section: Extract<HomepageCmsSection, { readonly type: "content_carousel" }> = {
      type: "content_carousel", title: "Stories", items: [
        { id: "safe", title: "Safe", body: null, href: "/stories/safe", media: { id: "safe-media", delivery_url: "/safe.webp", width: 800, height: 600, focal_x: 50, focal_y: 50, alt: "Safe image" } },
        { id: "unsafe", title: "Unsafe", body: null, href: "//evil.example", media: { id: "unsafe-media", delivery_url: "/unsafe.webp", width: 800, height: 600, focal_x: 50, focal_y: 50, alt: "Unsafe image" } },
      ],
    };

    renderWithWishlist(<CmsContentCarousel section={section} />);

    expect(screen.getByRole("link", { name: /Safe/ })).toHaveAttribute("href", "/stories/safe");
    expect(screen.getByText("Unsafe")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
    expect(screen.getByAltText("Safe image")).toHaveAttribute("src", "/safe.webp");
  });
});
