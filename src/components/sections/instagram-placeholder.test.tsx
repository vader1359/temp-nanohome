import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstagramGalleryPlaceholder } from "./instagram-placeholder";

describe("InstagramGalleryPlaceholder", () => {
  it("reserves the gallery section height before the interactive carousel loads", () => {
    // Given: the homepage has not downloaded the below-fold carousel bundle
    const { container } = render(<InstagramGalleryPlaceholder />);

    // When: the SSR placeholder is rendered
    const placeholder = container.querySelector("[data-instagram-placeholder]");

    // Then: it reserves a stable section footprint instead of shifting the footer later
    expect(placeholder).toHaveClass("min-h-[420px]", "sm:min-h-[500px]", "lg:min-h-[600px]");
  });
});
