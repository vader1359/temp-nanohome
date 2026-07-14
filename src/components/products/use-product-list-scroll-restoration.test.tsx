import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useProductListScrollRestoration } from "./use-product-list-scroll-restoration";

function ScrollRestorationHarness({ storageKey }: { storageKey: string }) {
  useProductListScrollRestoration(storageKey);
  return null;
}

describe("useProductListScrollRestoration", () => {
  it("restores the saved position and persists the latest position", () => {
    const key = "nanohome:test-products-scroll";
    window.sessionStorage.clear();
    window.sessionStorage.setItem(key, "420");
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    const rendered = render(<ScrollRestorationHarness storageKey={key} />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 420, behavior: "auto" });

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(window.sessionStorage.getItem(key)).toBe("0");

    rendered.unmount();
    requestAnimationFrame.mockRestore();
    scrollTo.mockRestore();
  });
});
