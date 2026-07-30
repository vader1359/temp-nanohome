import { describe, expect, it } from "vitest";

import type { PublicChatLocale } from "@/lib/chat/contracts";
import type { PublicChatSafeProduct } from "@/lib/chat/stream-events";
import { adaptChatProduct, adaptChatProducts } from "./chat-product-card-adapter";

const baseProduct: PublicChatSafeProduct = {
  variantId: "chair-one",
  title: "Ghế Việt",
  canonicalLink: "/vi/products/ghe-viet",
  image: {
    canonicalImageId: "chair-image",
    alt: "Ảnh ghế Việt",
    src: "https://res.cloudinary.com/nanohome-web/image/upload/products/chair",
  },
  price: { mode: "fixed", amount: 12_500_000, currency: "VND" },
  stock: { state: "available" },
  attributes: {
    brand: "Brand",
    designer: "Jane Designer",
    collection: "Icons",
    category: "Ghế",
  },
};

function adapt(product: PublicChatSafeProduct, locale: PublicChatLocale = "vi") {
  const result = adaptChatProduct(product, locale);
  if (!result.ok) throw new Error(`Expected eligible product, got ${result.reason}`);
  return result.product;
}

describe("chat product card adapter", () => {
  it("maps fixed prices with the requested locale and preserves currency", () => {
    const product = adapt(baseProduct, "vi");

    expect(product.price).toMatch(/12[.\s]500[.\s]000/);
    expect(product.price).toContain("₫");
  });

  it.each([
    ["contact", "Liên hệ"],
    ["unavailable", "Chưa có giá công khai"],
  ] as const)("maps %s price mode without fabricating a number", (mode, expected) => {
    const result = adaptChatProduct({ ...baseProduct, price: { mode } }, "vi");

    expect(result).toMatchObject({ ok: true, product: { price: expected } });
    expect(JSON.stringify(result)).not.toContain("0 ₫");
  });

  it.each([
    ["available", "in_stock"],
    ["unavailable", "out_of_stock"],
    ["unknown", "unknown"],
  ] as const)("maps %s stock to the shared status %s", (state, expected) => {
    expect(adapt({ ...baseProduct, stock: { state } }).status).toBe(expected);
  });

  it("treats missing stock as unknown rather than sold out", () => {
    expect(adapt({ ...baseProduct, stock: undefined }).status).toBe("unknown");
  });

  it.each([
    ["missing_brand", { attributes: { designer: "Jane Designer" } }],
    ["missing_image", { image: { ...baseProduct.image, src: undefined } }],
    ["missing_link", { canonicalLink: undefined }],
    ["invalid_price", { price: undefined }],
  ] as const)("skips a record with %s", (reason, changes) => {
    const result = adaptChatProduct({ ...baseProduct, ...changes } as PublicChatSafeProduct, "vi");

    expect(result).toEqual({ ok: false, reason });
  });

  it("rejects an invalid stock state without throwing", () => {
    const result = adaptChatProduct({
      ...baseProduct,
      stock: { state: "mystery" },
    } as unknown as PublicChatSafeProduct, "vi");

    expect(result).toEqual({ ok: false, reason: "invalid_stock" });
  });

  it("builds a deterministic deduplicated subtitle and keeps AI sale fields empty", () => {
    const input = structuredClone(baseProduct);
    const product = adapt({
      ...input,
      attributes: {
        brand: "Brand",
        designer: "Jane Designer",
        collection: "Icons",
        category: "Jane Designer",
      },
    });

    expect(product.subtitle).toBe("Jane Designer · Icons");
    expect(product.oldPrice).toBeNull();
    expect(product.discount).toBeNull();
    expect(product.swatches).toEqual([]);
    expect(input).toEqual(baseProduct);
  });

  it("skips malformed records independently and does not mutate the input list", () => {
    const input = [
      baseProduct,
      { ...baseProduct, variantId: "missing-image", image: undefined },
      { ...baseProduct, variantId: "contact", price: { mode: "contact" } },
    ] as const;

    const result = adaptChatProducts(input, "en");

    expect(result.products).toHaveLength(2);
    expect(result.products.map((product) => product.id)).toEqual(["chair-one", "contact"]);
    expect(result.products[1]?.price).toBe("Contact for price");
    expect(result.skipped).toEqual([{ variantId: "missing-image", reason: "missing_image" }]);
    expect(input[0]).toEqual(baseProduct);
  });
});
