import { describe, expect, it } from "vitest";

import { catalogResultEvent, publicChatEventSchema } from "./stream-events";

const responseId = `chat_${"a".repeat(32)}`;

const record = (variantId: string) => ({
  canonicalId: variantId,
  variantId,
  title: `Public ${variantId}`,
  canonicalLink: `/products/${variantId}`,
  image: { id: `${variantId}-image`, alt: `Public ${variantId}` },
  price: { mode: "fixed" as const, amount: 12_500_000, currency: "VND" },
  stock: { state: "available" as const },
  attributes: { category: "table" },
});

describe("verified catalog block events", () => {
  it("maps catalog records to the existing product block contract", () => {
    const event = catalogResultEvent(responseId, { kind: "catalog", records: [record("table-1")] });

    expect(publicChatEventSchema.parse(event)).toEqual({
      type: "block_ready",
      responseId,
      block: {
        type: "product_cards",
        products: [{
          ...record("table-1"),
          image: { canonicalImageId: "table-1-image", alt: "Public table-1" },
        }],
      },
    });
  });

  it("keeps only allowlisted comparison attributes and requires two records", () => {
    const event = catalogResultEvent(responseId, {
      kind: "comparison",
      records: [record("table-1"), record("table-2")],
      attributeKeys: ["dimensions", "private_notes"],
    });

    expect(publicChatEventSchema.parse(event)).toMatchObject({
      type: "block_ready",
      block: {
        type: "comparison",
        products: expect.arrayContaining([
          expect.objectContaining({ variantId: "table-1" }),
          expect.objectContaining({ variantId: "table-2" }),
        ]),
        attributeKeys: ["dimensions"],
      },
    });
    expect(catalogResultEvent(responseId, { kind: "comparison", records: [record("table-1")], attributeKeys: ["dimensions"] })).toBeUndefined();
  });
});
