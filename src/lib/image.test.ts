import { afterEach, describe, expect, it, vi } from "vitest";

const R2_BASE = "https://pub-test.r2.dev";
const previousMediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL;

async function loadImageModule(mediaUrl = R2_BASE) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_MEDIA_URL = mediaUrl;
  return import("./image");
}

afterEach(() => {
  if (previousMediaUrl === undefined) {
    delete process.env.NEXT_PUBLIC_MEDIA_URL;
  } else {
    process.env.NEXT_PUBLIC_MEDIA_URL = previousMediaUrl;
  }
});

describe("product image sources", () => {
  it("keeps an R2 public URL unchanged", async () => {
    const { firstProductImage } = await loadImageModule();
    const image = `${R2_BASE}/beb/TBLBB00014/TBLBB00014_PACKSHOT.png`;

    expect(firstProductImage([image])).toBe(image);
  });

  it("does not accept a lookalike R2 hostname", async () => {
    const { firstProductImage, placeholderUrl } = await loadImageModule();

    expect(firstProductImage(["https://pub-test.r2.dev.attacker.example/image.png"])).toBe(placeholderUrl());
  });

  it("continues resolving Cloudinary public IDs during migration", async () => {
    const { firstProductImage } = await loadImageModule();

    expect(firstProductImage(["products/example"])).toBe("https://res.cloudinary.com/nanohome-web/image/upload/products/example");
  });
});
