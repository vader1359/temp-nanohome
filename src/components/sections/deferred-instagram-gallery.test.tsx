import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstagramPost } from "@/lib/instagram-post";

const observe = vi.fn();
const disconnect = vi.fn();
let observerCallback: ((entries: readonly ObserverEntry[]) => void) | undefined;

type ObserverEntry = Readonly<{ isIntersecting: boolean }>;

vi.mock("next/dynamic", () => ({
  default: () => ({ posts }: { readonly posts: readonly InstagramPost[] }) => (
    <div data-post-count={posts.length} data-testid="instagram-gallery" />
  ),
}));

import { DeferredInstagramGallery } from "./deferred-instagram-gallery";

class IntersectionObserverMock {
  constructor(callback: (entries: readonly ObserverEntry[]) => void) {
    observerCallback = callback;
  }

  disconnect = disconnect;
  observe = observe;
}

const posts: readonly InstagramPost[] = [{
  id: "post-1",
  mediaType: "image",
  imageUrl: "https://lookaside.fbsbx.com/post-1.jpg",
  permalink: "https://www.instagram.com/p/post-1/",
  caption: "Room detail",
}];

describe("DeferredInstagramGallery", () => {
  afterEach(() => {
    observe.mockClear();
    disconnect.mockClear();
    observerCallback = undefined;
    vi.unstubAllGlobals();
  });

  it("loads the carousel only after its viewport sentinel intersects", () => {
    // Given: the below-fold carousel has not reached the viewport
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    const { container } = render(<DeferredInstagramGallery posts={posts} />);

    // When: the component mounts before its sentinel is visible
    const sentinel = container.querySelector("[data-instagram-sentinel]");

    // Then: it reserves layout without loading the carousel
    expect(sentinel).not.toBeNull();
    expect(screen.queryByTestId("instagram-gallery")).not.toBeInTheDocument();
    expect(observe).toHaveBeenCalledWith(sentinel);

    // When: the sentinel enters the viewport
    act(() => observerCallback?.([{ isIntersecting: true }]));

    // Then: the interactive carousel is mounted once
    expect(screen.getByTestId("instagram-gallery")).toHaveAttribute("data-post-count", "1");
    expect(disconnect).toHaveBeenCalled();
  });
});
