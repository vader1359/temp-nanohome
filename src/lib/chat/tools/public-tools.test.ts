import { describe, expect, it } from "vitest";

import { publicChatToolCallSchema } from "../contracts";
import { executePublicChatTool, publicChatCapabilities, type PublicChatToolAdapters } from "./public-tools";

const productRecord = {
  canonicalId: "chair-one",
  variantId: "variant-one",
  title: "Chair One",
  canonicalLink: "/products/chair-one",
  image: { id: "image-one", alt: "Chair One" },
  price: { mode: "contact" } as const,
  stock: { state: "unknown" } as const,
  attributes: { material: "Oak" },
  eligible: true,
  current: true,
};

const adapters: PublicChatToolAdapters = {
  catalog: {
    search: async () => [
      productRecord,
    ],
    details: async (ids) =>
      ids.includes("chair-one")
        ? [
            productRecord,
          ]
        : [],
    compare: async () => [],
  },
  site: { page: async () => ({ sectionKey: "delivery", locale: "en", title: "Delivery", body: "Public delivery details." }) },
  handoff: { create: async ({ reasonCode }) => ({ id: "handoff-one", reasonCode }) },
};

describe("public chat tool boundary", () => {
  it("rejects model identity, URLs, and arbitrary tool names", () => {
    expect(
      publicChatToolCallSchema.safeParse({
        name: "search_catalog",
        model: "deepseek",
        arguments: { query: "chair https://evil.example", limit: 1 },
      }).success,
    ).toBe(false);
    expect(publicChatToolCallSchema.safeParse({ name: "run_sql", arguments: {} }).success).toBe(false);
  });

  it("returns contact pricing without inventing a number or stock", async () => {
    const result = await executePublicChatTool(
      { name: "get_product_details", arguments: { canonicalIds: ["chair-one"] } },
      adapters,
    );

    expect(result).toEqual({ kind: "catalog", records: [expect.objectContaining({ price: { mode: "contact" }, stock: { state: "unknown" } })] });
    expect(result.kind === "catalog" && result.records[0]).not.toHaveProperty("eligible");
    expect(result.kind === "catalog" && result.records[0]).not.toHaveProperty("current");
  });

  it("executes structured catalog search through the v2 adapter", async () => {
    let observedRequest: unknown;
    const structuredAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: {
        ...adapters.catalog,
        searchStructured: async (request) => {
          observedRequest = request;
          return [productRecord];
        },
      },
    };

    const result = await executePublicChatTool({
      name: "search_catalog_v2",
      arguments: {
        productFamilies: ["table"],
        subtypes: [],
        categoryKeys: ["table"],
        collectionKeys: [],
        roomKeys: [],
        brandKeys: [],
        designerKeys: [],
        materialKeys: [],
        colorKeys: [],
        availability: "include_unknown",
        sort: "relevance",
        limit: 8,
      },
    }, structuredAdapters);

    expect(observedRequest).toEqual(expect.objectContaining({ productFamilies: ["table"], limit: 8 }));
    expect(result).toEqual({ kind: "catalog", records: [expect.objectContaining({ variantId: "variant-one" })] });
  });

  it("rejects out-of-range limits, comparison widths, and unsupported attributes", async () => {
    expect((await executePublicChatTool({ name: "search_catalog", arguments: { query: "chair", limit: 13 } }, adapters))).toEqual({ kind: "invalid_request" });
    expect(
      (await executePublicChatTool(
        { name: "compare_products", arguments: { variantIds: ["one", "two", "three", "four"], attributeKeys: ["material"] } },
        adapters,
      )),
    ).toEqual({ kind: "invalid_request" });
    expect(
      (await executePublicChatTool(
        { name: "compare_products", arguments: { variantIds: ["one", "two"], attributeKeys: ["price"] } },
        adapters,
      )),
    ).toEqual({ kind: "invalid_request" });
  });

  it("drops hidden or stale records before returning storefront data", async () => {
    const hiddenAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: { ...adapters.catalog, search: async () => [{ ...productRecord, eligible: false }] },
    };

    const result = await executePublicChatTool({ name: "search_catalog", arguments: { query: "chair", limit: 1 } }, hiddenAdapters);

    expect(result).toEqual({ kind: "catalog", records: [] });
  });

  it("disables recommendation capability with a typed result", async () => {
    const result = await executePublicChatTool({ name: "get_recommendations", arguments: { contextVariantIds: [] } }, adapters);

    expect(result).toEqual({ kind: "capability_unavailable", capability: "recommendation" });
  });

  it("issues a server-owned handoff record", async () => {
    const result = await executePublicChatTool({ name: "create_staff_handoff", arguments: { reasonCode: "unsupported_request" } }, adapters);

    expect(result).toEqual({ kind: "handoff", id: "handoff-one", reasonCode: "unsupported_request" });
  });

  it("returns a typed safe error when a public adapter fails", async () => {
    const failingAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: { ...adapters.catalog, search: async () => { throw new Error("database details"); } },
    };

    const result = await executePublicChatTool({ name: "search_catalog", arguments: { query: "chair", limit: 1 } }, failingAdapters);

    expect(result).toEqual({ kind: "adapter_error", operation: "search_catalog" });
  });

  it("passes cancellation to a started adapter and returns a safe typed result", async () => {
    // Given
    const controller = new AbortController();
    let adapterSignal: AbortSignal | undefined;
    const cancellableAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: {
        ...adapters.catalog,
        search: async (_query, _limit, signal) => {
          adapterSignal = signal;
          controller.abort();
          return [];
        },
      },
    };

    // When
    const result = await executePublicChatTool(
      { name: "search_catalog", arguments: { query: "chair", limit: 1 } },
      cancellableAdapters,
      controller.signal,
    );

    // Then
    expect(adapterSignal).toBe(controller.signal);
    expect(result).toEqual({ kind: "adapter_error", operation: "search_catalog" });
  });

  it("rejects adapter records that are not canonical public records", async () => {
    const unsafeAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: { ...adapters.catalog, search: async () => [{ ...productRecord, canonicalLink: "https://evil.example" }] },
    };

    const result = await executePublicChatTool({ name: "search_catalog", arguments: { query: "chair", limit: 1 } }, unsafeAdapters);

    expect(result).toEqual({ kind: "adapter_error", operation: "search_catalog" });
  });

  it("rejects unknown adapter attributes", async () => {
    const unsafeAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: { ...adapters.catalog, search: async () => [{ ...productRecord, attributes: { arbitrary: "value" } }] },
    };

    const result = await executePublicChatTool({ name: "search_catalog", arguments: { query: "chair", limit: 1 } }, unsafeAdapters);

    expect(result).toEqual({ kind: "adapter_error", operation: "search_catalog" });
  });

  it.each([
    { operation: "details", input: { name: "get_product_details", arguments: { canonicalIds: ["chair-one"] } }, output: [productRecord, productRecord] },
    { operation: "details-missing", input: { name: "get_product_details", arguments: { canonicalIds: ["chair-one", "chair-two"] } }, output: [productRecord] },
  ])("rejects $operation when the adapter does not return the exact requested canonical set", async ({ input, output }) => {
    const unsafeAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: { ...adapters.catalog, details: async () => output },
    };

    await expect(executePublicChatTool(input, unsafeAdapters)).resolves.toEqual({ kind: "adapter_error", operation: "get_product_details" });
  });

  it("rejects get_product_details adapter response containing extra stale or ineligible record before filtering", async () => {
    const extraStaleAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: {
        ...adapters.catalog,
        details: async () => [
          productRecord,
          { ...productRecord, canonicalId: "stale-chair", eligible: false, current: false },
        ],
      },
    };

    const result = await executePublicChatTool(
      { name: "get_product_details", arguments: { canonicalIds: ["chair-one"] } },
      extraStaleAdapters,
    );

    expect(result).toEqual({ kind: "adapter_error", operation: "get_product_details" });
  });

  it("returns not_found for get_product_details when exact requested records are returned but ineligible/stale", async () => {
    const staleAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: {
        ...adapters.catalog,
        details: async () => [
          { ...productRecord, canonicalId: "chair-one", eligible: false },
        ],
      },
    };

    const result = await executePublicChatTool(
      { name: "get_product_details", arguments: { canonicalIds: ["chair-one"] } },
      staleAdapters,
    );

    expect(result).toEqual({ kind: "not_found", resource: "catalog" });
  });

  it("rejects compare_products adapter response containing extra stale or ineligible record before filtering", async () => {
    const extraStaleAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: {
        ...adapters.catalog,
        compare: async () => [
          productRecord,
          { ...productRecord, variantId: "variant-two" },
          { ...productRecord, variantId: "stale-variant", eligible: false, current: false },
        ],
      },
    };

    const result = await executePublicChatTool(
      { name: "compare_products", arguments: { variantIds: ["variant-one", "variant-two"], attributeKeys: ["material"] } },
      extraStaleAdapters,
    );

    expect(result).toEqual({ kind: "adapter_error", operation: "compare_products" });
  });

  it("returns not_found for compare_products when exact requested records are returned but ineligible/stale", async () => {
    const staleAdapters: PublicChatToolAdapters = {
      ...adapters,
      catalog: {
        ...adapters.catalog,
        compare: async () => [
          { ...productRecord, variantId: "variant-one", eligible: false },
          { ...productRecord, variantId: "variant-two", eligible: true },
        ],
      },
    };

    const result = await executePublicChatTool(
      { name: "compare_products", arguments: { variantIds: ["variant-one", "variant-two"], attributeKeys: ["material"] } },
      staleAdapters,
    );

    expect(result).toEqual({ kind: "not_found", resource: "catalog" });
  });

  it("rejects duplicate comparison IDs and attributes", async () => {
    await expect(
      executePublicChatTool({ name: "compare_products", arguments: { variantIds: ["one", "one"], attributeKeys: ["material"] } }, adapters),
    ).resolves.toEqual({ kind: "invalid_request" });
    await expect(
      executePublicChatTool({ name: "compare_products", arguments: { variantIds: ["one", "two"], attributeKeys: ["material", "material"] } }, adapters),
    ).resolves.toEqual({ kind: "invalid_request" });
  });

  it("caps search results at the requested limit", async () => {
    const result = await executePublicChatTool(
      { name: "search_catalog", arguments: { query: "chair", limit: 1 } },
      { ...adapters, catalog: { ...adapters.catalog, search: async () => [productRecord, { ...productRecord, variantId: "variant-two" }] } },
    );

    expect(result.kind === "catalog" && result.records).toHaveLength(1);
  });

  it.each([
    "<script>alert(1)</script>",
    "![bad](/evil.png)",
    "See https://evil.example",
  ])("rejects hostile public page text: %s", async (text) => {
    const result = await executePublicChatTool(
      { name: "get_public_page", arguments: { sectionKey: "delivery", locale: "en" } },
      { ...adapters, site: { page: async () => ({ sectionKey: "delivery", locale: "en", title: text, body: "Safe" }) } },
    );

    expect(result).toEqual({ kind: "adapter_error", operation: "get_public_page" });
  });

  it("rejects a handoff when the adapter changes the requested reason", async () => {
    const result = await executePublicChatTool(
      { name: "create_staff_handoff", arguments: { reasonCode: "unsupported_request" } },
      { ...adapters, handoff: { create: async () => ({ id: "handoff-one", reasonCode: "staff_confirmation_required" }) } },
    );

    expect(result).toEqual({ kind: "adapter_error", operation: "create_staff_handoff" });
  });

  it("converts non-Error adapter failures into a safe typed result", async () => {
    const result = await executePublicChatTool(
      { name: "search_catalog", arguments: { query: "chair", limit: 1 } },
      { ...adapters, catalog: { ...adapters.catalog, search: async () => { throw "secret"; } } },
    );

    expect(result).toEqual({ kind: "adapter_error", operation: "search_catalog" });
  });

  it("exposes disabled public MVP capabilities", () => {
    expect(publicChatCapabilities).toEqual({ customer: false, order: false, vision: false, recommendation: false });
  });
});
