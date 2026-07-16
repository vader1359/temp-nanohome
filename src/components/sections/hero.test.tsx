import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HomepageCmsSection } from "@/lib/queries/homepage-cms";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { readonly children: React.ReactNode; readonly href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({ alt, fetchPriority, preload, priority, sizes, src }: { readonly alt: string; readonly fetchPriority?: string; readonly preload?: boolean; readonly priority?: boolean; readonly sizes?: string; readonly src: string }) => (
    <div aria-label={alt} data-fetch-priority={fetchPriority ?? "auto"} data-hero-image={src.startsWith("/images/home/hero/") || undefined} data-preload={preload || priority ? "true" : "false"} data-sizes={sizes} data-src={src} />
  ),
}));

import { Hero } from "./hero";

describe("Hero", () => {
  vi.useFakeTimers();

  it("preloads only the initial full-bleed slide", () => {
    // Given: the hero carousel starts on its first slide.
    render(<Hero />);

    // When: a visitor advances the carousel.
    const image = document.querySelector<HTMLElement>("[data-hero-image]");
    if (image === null) throw new Error("The hero image was not rendered");
    expect(image).toHaveAttribute("data-src", "/images/home/hero/hero-1.webp");
    expect(image).toHaveAttribute("data-sizes", "100vw");
    expect(image).toHaveAttribute("data-preload", "true");
    expect(image).toHaveAttribute("data-fetch-priority", "auto");
    expect(document.querySelectorAll("[data-preload=true]")).toHaveLength(1);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    });

    act(() => {
      vi.advanceTimersByTime(300); // Advance timer to allow fade state to swap index
    });

    // We must query the DOM again because the element reference might be stale or updated by React
    const updatedImage = document.querySelector<HTMLElement>("[data-hero-image]");
    if (updatedImage === null) throw new Error("The hero image was not rendered");

    expect(updatedImage).toHaveAttribute("data-src", "/images/home/hero/hero-2.webp");
    expect(updatedImage).toHaveAttribute("data-preload", "false");
    expect(updatedImage).toHaveAttribute("data-fetch-priority", "auto");
  });

  it("renders valid CMS media and resolved copy without static hotspot cards", () => {
    // Given: a typed CMS hero section with desktop and mobile media.
    const cmsHero: Extract<HomepageCmsSection, { readonly type: "hero" }> = {
      type: "hero",
      slides: [{
        id: "cms-slide-1",
        title: "CMS title",
        body: "CMS body",
        eyebrow: "CMS brand",
       cta_href: "/products/cms",
         ctaLabel: "Shop CMS",
         overlay_strength: 50,
        media: { id: "desktop", delivery_url: "https://example.com/desktop.webp", width: 1200, height: 800, focal_x: 50, focal_y: 50, alt: "CMS desktop" },
        mobileMedia: { id: "mobile", delivery_url: "https://example.com/mobile.webp", width: 600, height: 800, focal_x: 50, focal_y: 50, alt: "CMS mobile" },
        hotspots: [],
      }],
    };

    // When: the hero receives the CMS section.
    render(<Hero cmsHero={cmsHero} />);

    // Then: CMS content is shown and static hotspot markers are omitted.
    expect(screen.getByText("CMS title")).toBeInTheDocument();
    expect(screen.getByText("CMS body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop CMS" })).toHaveAttribute("href", "/products/cms");
    expect(screen.getByLabelText("CMS desktop")).toBeInTheDocument();
    expect(document.querySelector("[data-src='https://example.com/mobile.webp']")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xem sản phẩm nổi bật" })).not.toBeInTheDocument();
  });

  it("falls back to static slides for an empty CMS hero", () => {
    // Given: an empty typed CMS hero section.
    const cmsHero: Extract<HomepageCmsSection, { readonly type: "hero" }> = { type: "hero", slides: [] };

    // When: the hero receives the empty section.
    render(<Hero cmsHero={cmsHero} />);

    // Then: the static first slide remains visible and preloaded.
    expect(document.querySelector("[data-src='/images/home/hero/hero-1.webp']")).toHaveAttribute("data-preload", "true");
  });
});
