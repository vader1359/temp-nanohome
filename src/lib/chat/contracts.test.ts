import { describe, expect, it } from "vitest";

import {
  publicChatAnswerSchema,
  publicChatToolCallSchema,
  publicGoldenQuestions,
  resolvePublicChatAnswer,
  resolvePublicChatPolicy,
} from "./index";

describe("public chat contracts", () => {
  it("Given a server-resolved Vietnamese answer, When parsed, Then allowlisted blocks pass", () => {
    // Given: an answer whose visual references are canonical IDs only.
    const answer = {
      text: "Đây là các lựa chọn phù hợp.",
      blocks: [
        { type: "product_cards", variantIds: ["variant-1"] },
        { type: "link_list", sourceIds: ["delivery-policy-vi"] },
      ],
      evidence: [{ sourceId: "delivery-policy-vi" }],
      followUps: ["Bạn cần dùng cho phòng nào?"],
    };

    // When: the untrusted model output crosses the contract boundary.
    const result = publicChatAnswerSchema.safeParse(answer);

    // Then: it becomes a valid public answer.
    expect(result.success).toBe(true);
  });

  it("Given an answer ID from the model, When parsed, Then strict schema rejects it while the equivalent answer passes", () => {
    const answer = { text: "Public answer.", blocks: [], evidence: [], followUps: [] };

    expect(publicChatAnswerSchema.safeParse({ ...answer, answerId: "model-answer" }).success).toBe(false);
    expect(publicChatAnswerSchema.safeParse(answer).success).toBe(true);
  });

  it.each([
    { type: "image_gallery", imageUrls: ["https://evil.example/image.png"] },
    { type: "markdown", markdown: "![image](https://evil.example/image.png)" },
    { type: "product_cards", variantIds: ["variant-1"], userId: "customer-1" },
  ])("Given untrusted visual or identity data, When parsed, Then block %o is rejected", (block) => {
    // Given: a model-created block containing a forbidden key.
    const answer = {
      text: "Unsafe output",
      blocks: [block],
      evidence: [],
      followUps: [],
    };

    // When: the output is parsed.
    const result = publicChatAnswerSchema.safeParse(answer);

    // Then: it cannot enter the renderer.
    expect(result.success).toBe(false);
  });

  it.each([
    "<img src=\"https://evil.example/image.png\">",
    "![image](https://evil.example/image.png)",
  ])("Given unsafe answer text, When parsed, Then %s is rejected", (text) => {
    // Given: model output with a renderer-controlled payload.
    const answer = { text, blocks: [], evidence: [], followUps: [] };

    // When: it crosses the answer boundary.
    const result = publicChatAnswerSchema.safeParse(answer);

    // Then: HTML and Markdown image URLs cannot reach the renderer.
    expect(result.success).toBe(false);
  });

  it.each([
    { name: "search_catalog", arguments: { query: "oak", limit: 4 } },
    { name: "get_product_details", arguments: { canonicalIds: ["variant-1"] } },
    { name: "compare_products", arguments: { variantIds: ["variant-1", "variant-2"], attributeKeys: ["material"] } },
    { name: "get_recommendations", arguments: { contextVariantIds: ["variant-1"] } },
    { name: "get_public_page", arguments: { sectionKey: "delivery", locale: "en" } },
    { name: "create_staff_handoff", arguments: { reasonCode: "unsupported_request" } },
  ])("Given an approved public tool, When parsed, Then %s passes", (toolCall) => {
    // Given: an allowlisted tool and its bounded arguments.
    // When: the model requests it.
    const result = publicChatToolCallSchema.safeParse(toolCall);

    // Then: the server may authorize the request.
    expect(result.success).toBe(true);
  });

  it.each([
    { name: "get_my_order_status", arguments: { orderId: "order-1" } },
    { name: "search_catalog", arguments: { query: "oak", limit: 99 } },
    { name: "search_catalog", arguments: { query: "oak", url: "https://evil.example" } },
    { name: "get_public_page", arguments: { sectionKey: "delivery", locale: "en", userId: "customer-1" } },
    { name: "unknown_tool", arguments: {} },
  ])("Given a private, unbounded, URL-bearing, or unknown tool call, When parsed, Then %s is rejected", (toolCall) => {
    // Given: an unsupported model tool request.
    // When: it crosses the server boundary.
    const result = publicChatToolCallSchema.safeParse(toolCall);

    // Then: it is rejected before tool dispatch.
    expect(result.success).toBe(false);
  });
});

describe("public chat answer resolution", () => {
  it("Given parsed invented source, variant, and image IDs, When resolved against server registries, Then they cannot enter render-safe output", () => {
    // Given: syntactically valid model IDs that the server never issued.
    const parsedAnswer = publicChatAnswerSchema.parse({
      text: "Here are public options.",
      blocks: [
        { type: "product_cards", variantIds: ["variant-known", "model-invented-variant"] },
        { type: "comparison", variantIds: ["variant-known", "model-invented-variant"], attributeKeys: ["material"] },
        { type: "image_gallery", canonicalImageIds: ["image-known", "model-invented-image"] },
        { type: "link_list", sourceIds: ["source-known", "model-invented-source"] },
      ],
      evidence: [{ sourceId: "source-known" }, { sourceId: "model-invented-source" }],
      followUps: [],
    });

    // When: the server resolves the parsed proposal against owned records.
    const resolved = resolvePublicChatAnswer(
      parsedAnswer,
      {
        products: [{ variantId: "variant-known", title: "Known table" }],
        sources: [{ sourceId: "source-known", label: "Known policy" }],
        images: [{ canonicalImageId: "image-known", alt: "Known table image" }],
      },
      resolvePublicChatPolicy({ locale: "en", kind: "prompt_injection" }),
    );

    // Then: only registry-owned references remain renderable.
    expect(resolved).toEqual({
      text: "Here are public options.",
      blocks: [
        { type: "product_cards", products: [{ variantId: "variant-known", title: "Known table" }] },
        { type: "image_gallery", images: [{ canonicalImageId: "image-known", alt: "Known table image" }] },
        { type: "link_list", sources: [{ sourceId: "source-known", label: "Known policy" }] },
      ],
      evidence: [{ sourceId: "source-known", label: "Known policy" }],
      followUps: [],
    });
  });
});

describe("public chat policy", () => {
  it.each([
    ["vi", "Tôi có thể giúp bạn tìm sản phẩm phù hợp hoặc kết nối bạn với nhân viên."],
    ["en", "I can help you find suitable products or connect you with our staff."],
    ["ko", "적합한 제품을 찾거나 담당자 연결을 도와드릴 수 있습니다."],
  ] as const)("Given an unsupported request in %s, When policy resolves it, Then it returns the localized handoff", (locale, text) => {
    // Given: a request that cannot be safely grounded in public data.
    // When: the policy resolves it.
    const decision = resolvePublicChatPolicy({ locale, kind: "unsupported" });

    // Then: it hands off without inventing a claim.
    expect(decision).toEqual({ kind: "handoff", reasonCode: "unsupported_request", text });
  });

  it("Given a prompt-injection attempt, When policy resolves it, Then it refuses model-provided instructions", () => {
    // Given: retrieval content that attempts to override system controls.
    // When: the policy classifies the request.
    const decision = resolvePublicChatPolicy({ locale: "en", kind: "prompt_injection" });

    // Then: it returns the deterministic safe response.
    expect(decision).toEqual({
      kind: "refusal",
      reasonCode: "untrusted_instruction",
      text: "I can only use approved public website information and server-authorized tools.",
    });
  });

  it("Given a delivery promise request, When policy resolves it, Then it hands off instead of making a commercial claim", () => {
    // Given: a request requiring live, staff-confirmed fulfillment details.
    // When: the policy resolves it.
    const decision = resolvePublicChatPolicy({ locale: "en", kind: "commercial_promise" });

    // Then: it requires a staff handoff.
    expect(decision).toEqual({
      kind: "handoff",
      reasonCode: "staff_confirmation_required",
      text: "A team member can confirm delivery, stock, pricing, or installation details for you.",
    });
  });
});

describe("public chat golden questions", () => {
  it("Given the Phase 0 fixtures, When inspected, Then Vietnamese English and Korean grounded cases exist", () => {
    // Given: the versioned public-only evaluation fixture set.
    // When: the locales are collected.
    const locales = publicGoldenQuestions.map((question) => question.locale);

    // Then: each supported locale is represented.
    expect(locales).toEqual(expect.arrayContaining(["vi", "en", "ko"]));
  });

  it("Given the Phase 0 fixtures, When inspected, Then injection and unsupported handoff cases are covered", () => {
    // Given: the versioned public-only evaluation fixture set.
    // When: the expected policy outcomes are collected.
    const outcomes = publicGoldenQuestions.map((question) => question.expectedOutcome);

    // Then: adversarial and unsupported behavior is explicitly locked.
    expect(outcomes).toEqual(expect.arrayContaining(["refusal", "handoff"]));
  });
});
