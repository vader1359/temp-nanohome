import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const observe = vi.fn();
const disconnect = vi.fn();
let observerCallback: ((entries: readonly ObserverEntry[]) => void) | undefined;

type ObserverEntry = Readonly<{ isIntersecting: boolean }>;

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="instagram-gallery" />,
}));

import { DeferredInstagramGallery } from "./deferred-instagram-gallery";

class IntersectionObserverMock {
  constructor(callback: (entries: readonly ObserverEntry[]) => void) {
    observerCallback = callback;
  }

  disconnect = disconnect;
  observe = observe;
}

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
    const { container } = render(<DeferredInstagramGallery />);

    // When: the component mounts before its sentinel is visible
    const sentinel = container.querySelector("[data-instagram-sentinel]");

    // Then: it reserves layout without loading the carousel
    expect(sentinel).not.toBeNull();
    expect(screen.queryByTestId("instagram-gallery")).not.toBeInTheDocument();
    expect(observe).toHaveBeenCalledWith(sentinel);

    // When: the sentinel enters the viewport
    act(() => observerCallback?.([{ isIntersecting: true }]));

    // Then: the interactive carousel is mounted once
    expect(screen.getByTestId("instagram-gallery")).toBeInTheDocument();
    expect(disconnect).toHaveBeenCalled();
  });
});
