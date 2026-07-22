import { describe, expect, it } from "vitest";

import { orchestratePublicChat } from "./orchestrator";

describe("bounded public chat orchestration", () => {
  it("falls back when configuration is absent or answer is invalid", async () => {
    const result = await orchestratePublicChat({ question: "What is the price?", locale: "en", registries: { products: [], sources: [], images: [] }, policyDecision: { kind: "handoff", reasonCode: "staff_confirmation_required", text: "A team member can confirm pricing." } });
    expect(result.text).toBe("A team member can confirm pricing.");
    expect(result.blocks).toEqual([]);
  });

  it("executes at most the configured tool rounds and resolves only server-owned IDs", async () => {
    let calls = 0;
    const result = await orchestratePublicChat({
      question: "Find chairs",
      locale: "en",
      apiKey: "secret",
       provider: async () => ({ kind: "tool_call", call: { name: "search_catalog", arguments: { query: "chairs", limit: 12 } } }),
      executeTool: async () => { calls += 1; return { kind: "catalog", records: [] }; },
      registries: { products: [], sources: [], images: [] },
      policyDecision: { kind: "refusal", reasonCode: "untrusted_instruction", text: "I can only use approved public website information and server-authorized tools." },
    });
    expect(calls).toBe(2);
    expect(result.text).toContain("approved public");
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

    expect(result.blocks).toEqual([{ type: "product_cards", products: [{ variantId: "chair-01", canonicalId: "chair", title: "Public chair", canonicalLink: "/products/chair", image: { canonicalImageId: "chair-image", alt: "Public chair" } }] }]);
  });

  it("propagates the caller signal to every provider call", async () => {
    const controller = new AbortController();
    const signals: (AbortSignal | undefined)[] = [];
    await orchestratePublicChat({
      question: "Find chairs",
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

  it("falls back when injected provider or tool executor returns invalid data or throws", async () => {
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
    expect(invalid.text).toBe(policy.text);
    expect(toolFailure.text).toBe(policy.text);
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
    expect(result.text).toBe(policy.text);
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
});
