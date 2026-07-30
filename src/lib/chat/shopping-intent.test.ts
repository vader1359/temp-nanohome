import { describe, expect, it } from "vitest";

import {
  parseShoppingIntent,
  shoppingCatalogSearchRequestSchema,
  shoppingIntentToCatalogRequest,
} from "./shopping-intent";

describe("Vietnamese shopping intent parser", () => {
  it.each([
    ["Cho tôi xem các mẫu bàn hiện có", ["table"], []],
    ["Có bàn ăn nào?", ["table"], ["dining_table"]],
    ["Tìm bàn làm việc", ["desk"], ["work_desk"]],
    ["Ghế phòng khách", ["chair"], []],
    ["Sofa", ["sofa"], []],
    ["ban an", ["table"], ["dining_table"]],
    ["ghê lounge", ["chair"], ["lounge_chair"]],
  ] as const)("maps %s to hard product ontology", (question, families, subtypes) => {
    const intent = parseShoppingIntent(question, "vi");

    expect(intent.kind).toBe("product_search");
    expect(intent.productFamilies).toEqual(families);
    expect(intent.subtypes).toEqual(subtypes);
  });

  it("never interprets table lamp as a furniture table", () => {
    const intent = parseShoppingIntent("Đèn bàn đẹp", "vi");

    expect(intent.productFamilies).toEqual(["lamp"]);
    expect(intent.subtypes).toEqual(["table_lamp"]);
    expect(intent.categories).toEqual(["lamp"]);
    expect(intent.colors).toEqual([]);
  });

  it("keeps concrete consultation requests on the product path", () => {
    const intent = parseShoppingIntent("Tư vấn giúp tôi ghế cho phòng khách", "vi");

    expect(intent.kind).toBe("recommendation");
    expect(intent.productFamilies).toEqual(["chair"]);
    expect(intent.rooms).toEqual(["living"]);
  });

  it("does not turn the destination word đến into a lamp filter", () => {
    const intent = parseShoppingIntent("Giao sản phẩm đến nhà như thế nào?", "vi");

    expect(intent.kind).toBe("clarification");
    expect(intent.productFamilies).toEqual([]);
    expect(intent.productFamilies).not.toContain("lamp");
  });

  it("honors a negative lamp constraint when the user asks for a table", () => {
    const intent = parseShoppingIntent("Không phải đèn bàn, tôi cần bàn", "vi");

    expect(intent.productFamilies).toEqual(["table"]);
    expect(intent.productFamilies).not.toContain("lamp");
    expect(intent.ambiguity).toBeUndefined();
  });

  it("marks multiple product families as clarification instead of mixing cards", () => {
    const intent = parseShoppingIntent("Bàn và ghế cho phòng ăn", "vi");

    expect(intent.kind).toBe("clarification");
    expect(intent.ambiguity).toEqual(["product_family_grouped_result"]);
  });

  it("extracts brand, room, fixed-price budget, and availability as structured filters", () => {
    const intent = parseShoppingIntent("Bàn của USM cho phòng khách dưới 100 triệu còn hàng", "vi");
    const request = shoppingIntentToCatalogRequest(intent);

    expect(request).toEqual({
      productFamilies: ["table"],
      subtypes: [],
      categoryKeys: ["table"],
      collectionKeys: [],
      roomKeys: ["living"],
      brandKeys: ["usm"],
      designerKeys: [],
      materialKeys: [],
      colorKeys: [],
      maxPrice: 100_000_000,
      availability: "available_only",
      sort: "relevance",
      limit: 8,
      searchText: "usm",
    });
  });

  it("supports verified designer, collection, material, color, and price sorting filters", () => {
    const intent = parseShoppingIntent("Bàn màu đen bằng gỗ của Le Corbusier, bộ sưu tập LC, rẻ nhất", "vi");

    expect(intent.productFamilies).toEqual(["table"]);
    expect(intent.colors).toEqual(["black"]);
    expect(intent.materials).toEqual(["wood"]);
    expect(intent.designers).toEqual(["le_corbusier"]);
    expect(intent.collections).toEqual(["lc"]);
    expect(intent.sort).toBe("price_asc");
  });

  it("does not create a product result for broad recommendation questions", () => {
    const intent = parseShoppingIntent("Món nào hợp nhà tôi?", "vi");

    expect(intent.kind).toBe("clarification");
    expect(intent.ambiguity).toEqual(["product_family", "room", "budget"]);
    expect(shoppingIntentToCatalogRequest(intent)).toBeUndefined();
  });

  it("requires a concrete size decision instead of fabricating dimensions", () => {
    const intent = parseShoppingIntent("Bàn nhỏ dưới 120cm", "vi");

    expect(intent.kind).toBe("clarification");
    expect(intent.ambiguity).toEqual(["verified_dimensions"]);
  });

  it("recognizes policy, private, and exact-detail requests before catalog retrieval", () => {
    expect(parseShoppingIntent("Chính sách giao hàng?", "vi").kind).toBe("policy");
    expect(parseShoppingIntent("Cho tôi xem đơn hàng của tôi", "vi").kind).toBe("unsupported");
    expect(parseShoppingIntent("Thông tin sản phẩm SKU-123", "vi")).toEqual(expect.objectContaining({
      kind: "product_detail",
      searchText: "SKU-123",
      limit: 1,
    }));
  });
});

describe("structured catalog request contract", () => {
  it("rejects a reversed budget and unknown fields", () => {
    expect(shoppingCatalogSearchRequestSchema.safeParse({
      productFamilies: ["table"],
      subtypes: [],
      categoryKeys: [],
      collectionKeys: [],
      roomKeys: [],
      brandKeys: [],
      designerKeys: [],
      materialKeys: [],
      colorKeys: [],
      minPrice: 100,
      maxPrice: 10,
      availability: "include_unknown",
      sort: "relevance",
      limit: 8,
      debug: true,
    }).success).toBe(false);
  });
});
