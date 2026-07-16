import { describe, expect, it, vi } from "vitest";
import type { HomepageCmsModel, HomepageCmsSection } from "@/lib/queries/homepage-cms";

const state = vi.hoisted(() => ({
  cms: vi.fn(async (): Promise<HomepageCmsModel> => ({ sections: [] })),
  products: vi.fn(async () => []),
  productsBySkus: vi.fn(async () => []),
  brands: vi.fn(async () => []),
  setRequestLocale: vi.fn(),
}));

vi.mock("next-intl/server", () => ({ setRequestLocale: state.setRequestLocale }));
vi.mock("@/lib/queries/homepage-cms", () => ({ getHomepageCms: state.cms }));
vi.mock("@/lib/queries/products", () => ({ getVariantProducts: state.products, getVariantProductsBySkus: state.productsBySkus }));
vi.mock("@/lib/queries/brands", () => ({ getBrands: state.brands }));
vi.mock("@/lib/products/mapper", () => ({ variantToProductGridItem: vi.fn() }));
vi.mock("@/components/sections/hero", () => ({ Hero: (props: { readonly cmsHero?: Extract<HomepageCmsSection, { readonly type: "hero" }> }) => <div data-testid="hero" data-cms={props.cmsHero ? "present" : "absent"} /> }));
vi.mock("@/components/sections/cms-sections", () => ({
  CmsProductCuration: ({ section }: { readonly section: { readonly title: string } }) => <div data-section="curation">{section.title}</div>,
  CmsContentCarousel: ({ section }: { readonly section: { readonly title: string } }) => <div data-section="carousel">{section.title}</div>,
}));
vi.mock("@/components/sections/deferred-instagram-gallery", () => ({ DeferredInstagramGallery: () => <div data-testid="instagram" /> }));
vi.mock("@/components/sections/products-grid", () => ({ ProductsGrid: () => <div data-testid="products-grid" /> }));
vi.mock("@/components/sections/about", () => ({ About: () => <div data-testid="about" /> }));
vi.mock("@/components/sections/featured-products", () => ({ FeaturedProducts: () => <div data-testid="featured" /> }));
vi.mock("@/components/sections/rooms", () => ({ Rooms: () => <div data-testid="rooms" /> }));
vi.mock("@/components/sections/brands", () => ({ Brands: () => <div data-testid="brands" /> }));
vi.mock("@/components/sections/newsletter", () => ({ Newsletter: () => <div data-testid="newsletter" /> }));

import Page from "./page";

describe("localized homepage route", () => {
  it("loads CMS with a narrowed locale and renders ordered additive sections", async () => {
    state.cms.mockResolvedValueOnce({ sections: [
      { type: "content_carousel", title: "Stories", items: [] },
      { type: "product_curation", title: "Selected", items: [] },
      { type: "hero", slides: [] },
    ] });

    const page = await Page({ params: Promise.resolve({ locale: "fr" }) });
    expect(state.cms).toHaveBeenCalledWith("en");
    expect(state.setRequestLocale).toHaveBeenCalledWith("fr");
    expect(page).toBeDefined();
    expect(page.props.children).toHaveLength(9);
  });
});
