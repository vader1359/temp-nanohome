import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: ({ alt, sizes, src }: { readonly alt: string; readonly sizes?: string; readonly src: string }) => (
    <div aria-label={alt} data-newsletter-background={src === "/images/newsletter_bg.webp" || undefined} data-sizes={sizes} data-src={src} />
  ),
}));

import { Newsletter } from "./newsletter";

describe("Newsletter", () => {
  it("renders its decorative background through a responsive image", () => {
    // Given: the newsletter campaign section is rendered.
    render(<Newsletter />);

    // When: its background image is loaded.
    const background = document.querySelector("[data-newsletter-background]");

    // Then: the asset is optimized responsively and excluded from assistive technology.
    expect(background).toHaveAttribute("data-src", "/images/newsletter_bg.webp");
    expect(background).toHaveAttribute("data-sizes", "100vw");
  });
});
