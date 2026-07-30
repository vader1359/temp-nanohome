import { describe, expect, it } from "vitest";

import { orchestratePublicChat } from "./orchestrator";

describe("bounded public chat orchestration", () => {
  it("falls back when configuration is absent or answer is invalid", async () => {
    const result = await orchestratePublicChat({ question: "What is the price?", locale: "en", registries: { products: [], sources: [], images: [] }, policyDecision: { kind: "handoff", reasonCode: "staff_confirmation_required", text: "A team member can confirm pricing." } });
    expect(result.text).toBe("A team member can confirm pricing.");
    expect(result.blocks).toEqual([]);
  });

  it("retrieves a product question once and returns a clear localized no-result answer", async () => {
    let calls = 0;
    let providerCalls = 0;
    const result = await orchestratePublicChat({
      question: "Find chairs",
      locale: "en",
      apiKey: "secret",
      provider: async () => {
        providerCalls += 1;
        return { kind: "tool_call", call: { name: "search_catalog", arguments: { query: "chairs", limit: 12 } } };
      },
      executeTool: async () => { calls += 1; return { kind: "catalog", records: [] }; },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "refusal", reasonCode: "untrusted_instruction", text: "I can only use approved public website information and server-authorized tools." },
    });
    expect(calls).toBe(1);
    expect(providerCalls).toBe(0);
    expect(result.text).toContain("could not find an approved public product");
  });

  it("resolves visual blocks from catalog records produced during an allowlisted tool round", async () => {
    let providerCalls = 0;
    const result = await orchestratePublicChat({
      question: "Find chairs",
      locale: "en",
      apiKey: "secret",
      provider: async () => {
        providerCalls += 1;
        return providerCalls === 1
          ? { kind: "tool_call", call: { name: "search_catalog", arguments: { query: "chairs", limit: 1 } } }
          : { kind: "answer", answer: { text: "A public chair is available.", blocks: [{ type: "product_cards", variantIds: ["chair-01"] }], evidence: [], followUps: [] } };
      },
      executeTool: async () => ({
        kind: "catalog",
        records: [{ canonicalId: "chair", variantId: "chair-01", title: "Public chair", canonicalLink: "/products/chair", image: { id: "chair-image", alt: "Public chair" }, price: { mode: "contact" }, stock: { state: "unknown" }, attributes: {} }],
      }),
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(result.blocks).toEqual([{ type: "product_cards", products: [{ variantId: "chair-01", canonicalId: "chair", title: "Public chair", canonicalLink: "/products/chair", image: { canonicalImageId: "chair-image", alt: "Public chair" }, price: { mode: "contact" }, stock: { state: "unknown" }, attributes: {} }] }]);
  });

  it("returns canonical product cards immediately after a successful catalog tool result", async () => {
    const result = await orchestratePublicChat({
      question: "Find chairs",
      locale: "vi",
      apiKey: "secret",
      provider: async () => ({ kind: "tool_call", call: { name: "search_catalog", arguments: { query: "chair", limit: 1 } } }),
      executeTool: async () => ({
        kind: "catalog",
        records: [{ canonicalId: "chair", variantId: "chair-01", title: "Public chair", canonicalLink: "/vi/products/chair", image: { id: "chair-image", alt: "Public chair" }, price: { mode: "contact" }, stock: { state: "unknown" }, attributes: {} }],
      }),
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });
    expect(result.text).toContain("danh mục hiện có");
    expect(result.blocks).toEqual([expect.objectContaining({ type: "product_cards", products: [expect.objectContaining({ variantId: "chair-01" })] })]);
  });

  it("propagates the caller signal to every provider call", async () => {
    const controller = new AbortController();
    const signals: (AbortSignal | undefined)[] = [];
    await orchestratePublicChat({
      question: "Tell me about nanoHome",
      locale: "en",
      apiKey: "secret",
      signal: controller.signal,
      provider: async (providerInput) => {
        signals.push(providerInput.signal);
        return { kind: "unavailable", reason: "provider_error" };
      },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "refusal", reasonCode: "untrusted_instruction", text: "Safe fallback." },
    });
    expect(signals).toEqual([controller.signal]);
  });

  it("returns explicit provider and adapter errors when injected boundaries fail", async () => {
    const policy = { kind: "refusal" as const, reasonCode: "untrusted_instruction" as const, text: "Safe fallback." };
    const invalid = await orchestratePublicChat({
      question: "x", locale: "en", apiKey: "secret", provider: async () => ({ kind: "answer", answer: { hostile: true } }),
      registries: { products: [], sources: [], images: [] }, policyDecision: policy,
    });
    const toolFailure = await orchestratePublicChat({
      question: "x", locale: "en", apiKey: "secret",
      provider: async () => ({ kind: "tool_call", call: { name: "search_catalog", arguments: { query: "x", limit: 1 } } }),
      executeTool: async () => { throw "private customer error"; },
      registries: { products: [], sources: [], images: [] }, policyDecision: policy,
    });
    expect(invalid.text).toContain("AI advisory service is temporarily unavailable");
    expect(toolFailure.text).toContain("Product and website data are temporarily unavailable");
  });

  it("does not execute an injected invalid tool call", async () => {
    let calls = 0;
    const policy = { kind: "refusal" as const, reasonCode: "untrusted_instruction" as const, text: "Safe fallback." };
    const result = await orchestratePublicChat({
      question: "x", locale: "en", apiKey: "secret",
      provider: async () => ({ kind: "tool_call", call: { name: "unknown_tool", arguments: { query: "x" } } }),
      executeTool: async () => { calls += 1; return { kind: "invalid_request" }; },
      registries: { products: [], sources: [], images: [] }, policyDecision: policy,
    });
    expect(calls).toBe(0);
    expect(result.text).toContain("AI advisory service is temporarily unavailable");
  });

  it("stops before executing a tool when cancellation arrives after the provider result", async () => {
    const controller = new AbortController();
    let calls = 0;
    const policy = { kind: "refusal" as const, reasonCode: "untrusted_instruction" as const, text: "Safe fallback." };
    const result = await orchestratePublicChat({
      question: "x", locale: "en", apiKey: "secret", signal: controller.signal,
      provider: async () => {
        controller.abort();
        return { kind: "tool_call", call: { name: "search_catalog", arguments: { query: "x", limit: 1 } } };
      },
      executeTool: async () => { calls += 1; return { kind: "invalid_request" }; },
      registries: { products: [], sources: [], images: [] }, policyDecision: policy,
    });
    expect(calls).toBe(0);
    expect(result.text).toBe(policy.text);
  });

  it("retrieves catalog data before the model and makes the model answer from those records", async () => {
    const observedToolResultKinds: string[][] = [];
    let toolCalls = 0;
    const result = await orchestratePublicChat({
      question: "Ghế nào phù hợp cho phòng khách?",
      locale: "vi",
      apiKey: "secret",
      provider: async ({ toolResults }) => {
        observedToolResultKinds.push(toolResults.map(({ kind }) => kind));
        return {
          kind: "answer",
          answer: {
            text: "Mẫu ghế này nằm trong danh mục công khai phù hợp để bạn cân nhắc.",
            blocks: [],
            evidence: [],
            followUps: [],
          },
        };
      },
      executeTool: async (call) => {
        toolCalls += 1;
        expect(call).toEqual({
          name: "search_catalog",
          arguments: { query: "Ghế nào phù hợp cho phòng khách?", limit: 8 },
        });
        return {
          kind: "catalog",
          records: [{
            canonicalId: "chair",
            variantId: "chair-01",
            title: "Public chair",
            canonicalLink: "/vi/products/chair",
            image: { id: "chair-image", alt: "Public chair" },
            price: { mode: "contact" },
            stock: { state: "unknown" },
            attributes: { category: "Chair" },
          }],
        };
      },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(toolCalls).toBe(1);
    expect(observedToolResultKinds).toEqual([["catalog"]]);
    expect(result.text).toContain("Mẫu ghế này");
    expect(result.blocks).toEqual([
      expect.objectContaining({
        type: "product_cards",
        products: [expect.objectContaining({ variantId: "chair-01" })],
      }),
    ]);
  });

  it("uses structured v2 retrieval and refuses a provider attempt to widen the family filter", async () => {
    const executedCalls: unknown[] = [];
    let providerCalls = 0;
    const result = await orchestratePublicChat({
      question: "Chỉ cho tôi bàn ăn dưới 100 triệu còn hàng",
      locale: "vi",
      apiKey: "secret",
      toolAdapters: {
        catalog: {
          search: async () => [],
          searchStructured: async () => [],
          details: async () => [],
          compare: async () => [],
        },
        site: { page: async () => null },
        handoff: {
          create: async () => ({ id: "handoff-1", reasonCode: "unsupported_request" as const }),
        },
      },
      provider: async () => {
        providerCalls += 1;
        return {
          kind: "tool_call",
          call: {
            name: "search_catalog_v2",
            arguments: {
              productFamilies: ["lamp"],
              subtypes: [],
              categoryKeys: ["lamp"],
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
          },
        };
      },
      executeTool: async (call) => {
        executedCalls.push(call);
        return {
          kind: "catalog",
          records: [{
            canonicalId: "dining-table",
            variantId: "dining-table-01",
            title: "Public dining table",
            canonicalLink: "/vi/products/dining-table",
            image: { id: "dining-table-image", alt: "Public dining table" },
            price: { mode: "contact" as const },
            stock: { state: "unknown" as const },
            attributes: { category: "table" },
          }],
        };
      },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(providerCalls).toBe(1);
    expect(executedCalls).toHaveLength(1);
    expect(executedCalls[0]).toMatchObject({
      name: "search_catalog_v2",
      arguments: {
        productFamilies: ["table"],
        subtypes: ["dining_table"],
        maxPrice: 100_000_000,
        availability: "available_only",
      },
    });
    expect(result.blocks).toEqual([
      expect.objectContaining({
        type: "product_cards",
        products: [expect.objectContaining({ variantId: "dining-table-01" })],
      }),
    ]);
  });

  it("caps ordinary product rendering to one provider round after deterministic retrieval", async () => {
    let providerCalls = 0;
    const result = await orchestratePublicChat({
      question: "Find chairs",
      locale: "en",
      apiKey: "secret",
      provider: async () => {
        providerCalls += 1;
        return {
          kind: "tool_call",
          call: { name: "get_product_details", arguments: { canonicalIds: ["unverified-id"] } },
        };
      },
      executeTool: async () => ({
        kind: "catalog",
        records: [{
          canonicalId: "chair",
          variantId: "chair-01",
          title: "Public chair",
          canonicalLink: "/products/chair",
          image: { id: "chair-image", alt: "Public chair" },
          price: { mode: "contact" as const },
          stock: { state: "unknown" as const },
          attributes: {},
        }],
      }),
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(providerCalls).toBe(1);
    expect(result.blocks).toEqual([
      expect.objectContaining({
        type: "product_cards",
        products: [expect.objectContaining({ variantId: "chair-01" })],
      }),
    ]);
  });

  it("treats a concrete Vietnamese consultation request as product discovery", async () => {
    let toolCalls = 0;
    const result = await orchestratePublicChat({
      question: "Tư vấn giúp tôi ghế cho phòng khách",
      locale: "vi",
      apiKey: "secret",
      provider: async () => ({ kind: "invalid_output" }),
      executeTool: async (call) => {
        toolCalls += 1;
        expect(call).toEqual({
          name: "search_catalog",
          arguments: {
            query: "Tư vấn giúp tôi ghế cho phòng khách",
            limit: 8,
          },
        });
        return {
          kind: "catalog",
          records: [{
            canonicalId: "chair",
            variantId: "chair-01",
            title: "Public chair",
            canonicalLink: "/vi/products/chair",
            image: { id: "chair-image", alt: "Public chair" },
            price: { mode: "contact" },
            stock: { state: "unknown" },
            attributes: {},
          }],
        };
      },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(toolCalls).toBe(1);
    expect(result.blocks).toEqual([
      expect.objectContaining({
        type: "product_cards",
        products: [expect.objectContaining({ variantId: "chair-01" })],
      }),
    ]);
  });

  it("replaces model-invented visual IDs with verified catalog cards", async () => {
    const result = await orchestratePublicChat({
      question: "Find chairs",
      locale: "en",
      apiKey: "secret",
      provider: async () => ({
        kind: "answer",
        answer: {
          text: "Here is a verified catalog option.",
          blocks: [{ type: "product_cards", variantIds: ["invented-chair"] }],
          evidence: [],
          followUps: [],
        },
      }),
      executeTool: async () => ({
        kind: "catalog",
        records: [{
          canonicalId: "chair",
          variantId: "chair-01",
          title: "Public chair",
          canonicalLink: "/en/products/chair",
          image: { id: "chair-image", alt: "Public chair" },
          price: { mode: "contact" },
          stock: { state: "unknown" },
          attributes: {},
        }],
      }),
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(result.blocks).toEqual([
      expect.objectContaining({
        type: "product_cards",
        products: [expect.objectContaining({ variantId: "chair-01" })],
      }),
    ]);
  });

  it("allows a verified comparison follow-up after catalog retrieval", async () => {
    const records = [
      {
        canonicalId: "chair-a",
        variantId: "chair-a-01",
        title: "Chair A",
        canonicalLink: "/en/products/chair-a",
        image: { id: "chair-a-image", alt: "Chair A" },
        price: { mode: "contact" as const },
        stock: { state: "unknown" as const },
        attributes: { material: "Leather" },
      },
      {
        canonicalId: "chair-b",
        variantId: "chair-b-01",
        title: "Chair B",
        canonicalLink: "/en/products/chair-b",
        image: { id: "chair-b-image", alt: "Chair B" },
        price: { mode: "contact" as const },
        stock: { state: "unknown" as const },
        attributes: { material: "Fabric" },
      },
    ] as const;
    const executedCalls: unknown[] = [];
    let providerCalls = 0;
    const result = await orchestratePublicChat({
      question: "Compare these living room chairs",
      locale: "en",
      apiKey: "secret",
      provider: async () => {
        providerCalls += 1;
        return providerCalls === 1
          ? {
              kind: "tool_call",
              call: {
                name: "compare_products",
                arguments: {
                  variantIds: ["chair-a-01", "chair-b-01"],
                  attributeKeys: ["material"],
                },
              },
            }
          : {
              kind: "answer",
              answer: {
                text: "Here is the verified material comparison.",
                blocks: [{
                  type: "comparison",
                  variantIds: ["chair-a-01", "chair-b-01"],
                  attributeKeys: ["material"],
                }],
                evidence: [],
                followUps: [],
              },
            };
      },
      executeTool: async (call) => {
        executedCalls.push(call);
        return executedCalls.length === 1
          ? { kind: "catalog", records }
          : { kind: "comparison", records, attributeKeys: ["material"] };
      },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(executedCalls).toHaveLength(2);
    expect(executedCalls[0]).toEqual({
      name: "search_catalog",
      arguments: {
        query: "Compare these living room chairs",
        limit: 4,
      },
    });
    expect(executedCalls[1]).toEqual({
      name: "compare_products",
      arguments: {
        variantIds: ["chair-a-01", "chair-b-01"],
        attributeKeys: ["material"],
      },
    });
    expect(result.blocks).toEqual([
      expect.objectContaining({
        type: "comparison",
        products: [
          expect.objectContaining({ variantId: "chair-a-01" }),
          expect.objectContaining({ variantId: "chair-b-01" }),
        ],
      }),
    ]);
  });

  it("does not execute the same product tool call after retrieval has already grounded the request", async () => {
    let toolCalls = 0;
    const question = "Find chairs";
    const result = await orchestratePublicChat({
      question,
      locale: "en",
      apiKey: "secret",
      provider: async () => ({
        kind: "tool_call",
        call: { name: "search_catalog", arguments: { query: question, limit: 8 } },
      }),
      executeTool: async () => {
        toolCalls += 1;
        return {
          kind: "catalog",
          records: [{
            canonicalId: "chair",
            variantId: "chair-01",
            title: "Public chair",
            canonicalLink: "/products/chair",
            image: { id: "chair-image", alt: "Public chair" },
            price: { mode: "contact" },
            stock: { state: "unknown" },
            attributes: {},
          }],
        };
      },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(toolCalls).toBe(1);
    expect(result.blocks).toEqual([
      expect.objectContaining({
        type: "product_cards",
        products: [expect.objectContaining({ variantId: "chair-01" })],
      }),
    ]);
  });

  it("prefers verified catalog cards over unrelated evidence when the provider output is invalid", async () => {
    const result = await orchestratePublicChat({
      question: "Ghế nào phù hợp cho phòng khách?",
      locale: "vi",
      apiKey: "secret",
      evidence: [{
        sourceId: "about_nanohome",
        text: "nanoHome tuyển chọn nội thất chính hãng.",
      }],
      provider: async () => ({ kind: "invalid_output" }),
      executeTool: async () => ({
        kind: "catalog",
        records: [{
          canonicalId: "chair",
          variantId: "chair-01",
          title: "Public chair",
          canonicalLink: "/vi/products/chair",
          image: { id: "chair-image", alt: "Public chair" },
          price: { mode: "contact" },
          stock: { state: "unknown" },
          attributes: {},
        }],
      }),
      registries: {
        products: [],
        sources: [{ sourceId: "about_nanohome", label: "Giới thiệu nanoHome" }],
        images: [],
      },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(result.text).toContain("danh mục hiện có");
    expect(result.blocks).toEqual([
      expect.objectContaining({
        type: "product_cards",
        products: [expect.objectContaining({ variantId: "chair-01" })],
      }),
    ]);
  });

  it.each([
    ["vi", "Chính sách đổi trả và hoàn tiền thế nào?", "returns"],
    ["vi", "Tôi có thể trả hàng không?", "returns"],
    ["vi", "Tôi có đổi ghế được không?", "returns"],
    ["en", "Can I exchange this chair?", "returns"],
    ["ko", "의자 교환이 가능한가요?", "returns"],
  ] as const)(
    "answers an unpublished %s policy question deterministically: %s",
    async (locale, question, sectionKey) => {
    let providerCalls = 0;
    let toolCalls = 0;
    const result = await orchestratePublicChat({
      question,
      locale,
      apiKey: "secret",
      provider: async () => {
        providerCalls += 1;
        return { kind: "invalid_output" };
      },
      executeTool: async (call) => {
        toolCalls += 1;
        expect(call).toEqual({
          name: "get_public_page",
          arguments: { sectionKey, locale },
        });
        return { kind: "not_found", resource: "page" };
      },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(toolCalls).toBe(1);
    expect(providerCalls).toBe(0);
    expect(result.blocks).toEqual([]);
    expect(result.text.length).toBeGreaterThan(20);
  });

  it("does not execute a tool when approved evidence is already available", async () => {
    let toolCalls = 0;
    let providerCalls = 0;
    const result = await orchestratePublicChat({
      question: "nanoHome là thương hiệu gì?",
      locale: "vi",
      apiKey: "secret",
      evidence: [{ sourceId: "about_nanohome", text: "nanoHome tuyển chọn nội thất chính hãng từ các thương hiệu quốc tế." }],
      provider: async () => {
        providerCalls += 1;
        return {
          kind: "tool_call",
          call: { name: "search_catalog", arguments: { query: "nanoHome", limit: 8 } },
        };
      },
      executeTool: async () => {
        toolCalls += 1;
        return { kind: "catalog", records: [] };
      },
      registries: {
        products: [],
        sources: [{ sourceId: "about_nanohome", label: "Giới thiệu nanoHome" }],
        images: [],
      },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(toolCalls).toBe(0);
    expect(providerCalls).toBe(1);
    expect(result.text).toContain("nanoHome tuyển chọn nội thất chính hãng");
    expect(result.evidence).toEqual([{ sourceId: "about_nanohome", label: "Giới thiệu nanoHome" }]);
  });

  it("rejects unsupported factual additions even when the model cites an approved source", async () => {
    const result = await orchestratePublicChat({
      question: "nanoHome là thương hiệu gì?",
      locale: "vi",
      apiKey: "secret",
      evidence: [{
        sourceId: "about_nanohome",
        text: "nanoHome tuyển chọn nội thất chính hãng từ các thương hiệu quốc tế.",
      }],
      provider: async () => ({
        kind: "answer",
        answer: {
          text: "nanoHome có ba showroom tại Paris.",
          blocks: [{ type: "link_list", sourceIds: ["about_nanohome"] }],
          evidence: [{ sourceId: "about_nanohome" }],
          followUps: [],
        },
      }),
      executeTool: async () => {
        throw new Error("tool should not run");
      },
      registries: {
        products: [],
        sources: [{ sourceId: "about_nanohome", label: "Giới thiệu nanoHome" }],
        images: [],
      },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(result.text).toContain("nanoHome tuyển chọn nội thất chính hãng");
    expect(result.text).not.toContain("Paris");
    expect(result.evidence).toEqual([{ sourceId: "about_nanohome", label: "Giới thiệu nanoHome" }]);
  });

  it("treats a delivery question containing 'sản phẩm' as website knowledge, not catalog discovery", async () => {
    let toolCalls = 0;
    const result = await orchestratePublicChat({
      question: "Giao sản phẩm đến nhà như thế nào?",
      locale: "vi",
      apiKey: "secret",
      evidence: [{
        sourceId: "delivery",
        text: "nanoHome hỗ trợ giao sản phẩm đến nhà theo thông tin giao hàng công khai.",
      }],
      provider: async () => ({
        kind: "answer",
        answer: {
          text: "nanoHome hỗ trợ giao sản phẩm đến nhà theo thông tin giao hàng công khai.",
          blocks: [{ type: "link_list", sourceIds: ["delivery"] }],
          evidence: [{ sourceId: "delivery" }],
          followUps: [],
        },
      }),
      executeTool: async () => {
        toolCalls += 1;
        return { kind: "catalog", records: [] };
      },
      registries: {
        products: [],
        sources: [{ sourceId: "delivery", label: "Giao hàng" }],
        images: [],
      },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Safe fallback." },
    });

    expect(toolCalls).toBe(0);
    expect(result.text).toContain("hỗ trợ giao sản phẩm đến nhà");
  });

  it("distinguishes an adapter failure from an empty catalog result in Vietnamese", async () => {
    const result = await orchestratePublicChat({
      question: "Tìm ghế cho phòng khách",
      locale: "vi",
      apiKey: "secret",
      provider: async () => {
        throw new Error("provider should not run");
      },
      executeTool: async () => ({ kind: "adapter_error", operation: "search_catalog" }),
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "handoff", reasonCode: "unsupported_request", text: "Fallback mơ hồ." },
    });

    expect(result.text).toContain("tạm thời không khả dụng");
    expect(result.text).not.toBe("Fallback mơ hồ.");
  });
});
