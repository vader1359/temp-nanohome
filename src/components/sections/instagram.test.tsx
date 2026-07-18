import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { InstagramPost } from "@/lib/instagram-post";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { readonly alt: string; readonly src: string }) => (
    <img alt={alt} data-testid="instagram-image" src={src} />
  ),
}));

vi.mock("keen-slider/react", () => ({
  useKeenSlider: () => [vi.fn(), { current: { next: vi.fn(), prev: vi.fn() } }],
}));

import { InstagramGallery } from "./instagram";

const posts: readonly InstagramPost[] = [
  {
    id: "image-1",
    mediaType: "image",
    imageUrl: "https://lookaside.fbsbx.com/image-1.jpg",
    permalink: "https://www.instagram.com/p/image-1/",
    caption: "Living room",
  },
  {
    id: "video-1",
    mediaType: "video",
    videoUrl: "https://lookaside.fbsbx.com/video-1.mp4",
    thumbnailUrl: "https://lookaside.fbsbx.com/video-1.jpg",
    permalink: "https://www.instagram.com/reel/video-1/",
    caption: "Room reel",
  },
];

describe("InstagramGallery", () => {
  it("autoplays video previews and opens a playable lightbox", () => {
    // Given: the live feed includes an Instagram reel.
    render(<InstagramGallery posts={posts} />);

    // When: a visitor opens the reel.
    const preview = screen.getByTestId("instagram-video-preview");
    expect(preview).toHaveAttribute("autoplay");
    expect((preview as HTMLVideoElement).muted).toBe(true);
    expect(preview).toHaveAttribute("loop");
    expect(preview).toHaveAttribute("playsinline");
    expect(preview).toHaveAttribute("poster", "https://lookaside.fbsbx.com/video-1.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Open video post 2" }));

    // Then: the lightbox exposes native playback controls for the reel.
    const lightboxVideo = screen.getByTestId("instagram-video-lightbox");
    expect(lightboxVideo).toHaveAttribute("controls");
    expect(lightboxVideo).toHaveAttribute("autoplay");
    expect((lightboxVideo as HTMLVideoElement).muted).toBe(true);
    expect(lightboxVideo).toHaveAttribute("playsinline");
    expect(lightboxVideo).toHaveAttribute("src", "https://lookaside.fbsbx.com/video-1.mp4");
  });

  it("locks document scrolling while the lightbox is open", () => {
    // Given: the page has its default document scroll behavior.
    document.body.style.overflow = "";
    render(<InstagramGallery posts={posts} />);

    // When: a visitor opens then closes an Instagram reel.
    fireEvent.click(screen.getByRole("button", { name: "Open video post 2" }));
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });

    // Then: background scroll is restored after the lightbox closes.
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });
});
