import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: ({ alt, fetchPriority, preload, priority, sizes, src }: { readonly alt: string; readonly fetchPriority?: string; readonly preload?: boolean; readonly priority?: boolean; readonly sizes?: string; readonly src: string }) => (
    <div aria-label={alt} data-fetch-priority={fetchPriority ?? "auto"} data-hero-image={src.startsWith("/images/home/hero/") || undefined} data-preload={preload || priority ? "true" : "false"} data-sizes={sizes} data-src={src} />
  ),
}));

import { Hero } from "./hero";

describe("Hero", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

    // Then: only the active image changes and later slides are not preloaded.
    expect(image).toHaveAttribute("data-src", "/images/home/hero/hero-2.webp");
    expect(image).toHaveAttribute("data-preload", "false");
    expect(image).toHaveAttribute("data-fetch-priority", "auto");
  });
});
