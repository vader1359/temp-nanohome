import { describe, expect, it } from "vitest";

import {
  publicChatAnswerSchema,
  resolvePublicChatAnswer,
  resolvePublicChatPolicy,
} from "./index";
import { PublicChatResolutionError, resolvePublicChatAnswerWithCatalog } from "./resolution";

const registries = {
  products: [
    { variantId: "variant-one", title: "One" },
    { variantId: "variant-two", title: "Two" },
  ],
  sources: [{ sourceId: "source-one", label: "One source" }],
  images: [{ canonicalImageId: "image-one", alt: "One image" }],
};

const noHandoffDecision = resolvePublicChatPolicy({ locale: "en", kind: "prompt_injection" });
const authorizedHandoff = resolvePublicChatPolicy({ locale: "en", kind: "unsupported" });

function parseAnswer(blocks: readonly object[], evidence: readonly object[] = []) {
  return publicChatAnswerSchema.parse({
    text: "Public answer.",
    blocks,
    evidence,
    followUps: [],
  });
}

describe("public chat resolver provenance", () => {
  it("Given a model handoff without matching server authorization, When resolved, Then it is dropped", () => {
    const answer = parseAnswer([{ type: "staff_handoff", reasonCode: "unsupported_request" }]);

    const resolved = resolvePublicChatAnswer(answer, registries, noHandoffDecision);

    expect(resolved.blocks).toEqual([]);
  });

  it("Given a model handoff matching the server policy decision, When resolved, Then it is render-safe", () => {
    const answer = parseAnswer([{ type: "staff_handoff", reasonCode: "unsupported_request" }]);

    const resolved = resolvePublicChatAnswer(answer, registries, authorizedHandoff);

    expect(resolved.blocks).toEqual([{ type: "staff_handoff", reasonCode: "unsupported_request" }]);
  });

  it("re-resolves model variants through the server catalog before rendering", async () => {
    const answer = parseAnswer([{ type: "product_cards", variantIds: ["variant-one"] }]);

    const resolved = await resolvePublicChatAnswerWithCatalog(
      answer,
      {
        resolveVariants: async () => [
          {
            variantId: "variant-one",
            canonicalId: "canonical-chair",
            title: "Canonical Chair",
            canonicalLink: "/products/canonical-chair",
             image: { canonicalImageId: "canonical-image", alt: "Canonical chair" },
             eligible: true,
             current: true,
          },
        ],
      },
      noHandoffDecision,
    );

    expect(resolved.blocks).toEqual([
      {
        type: "product_cards",
        products: [{ variantId: "variant-one", title: "Canonical Chair", canonicalId: "canonical-chair", canonicalLink: "/products/canonical-chair", image: { canonicalImageId: "canonical-image", alt: "Canonical chair" } }],
      },
    ]);
  });

  it.each([
    { name: "duplicate IDs", variants: [{ variantId: "variant-one", canonicalId: "canonical-chair", title: "Chair", canonicalLink: "/products/chair", image: { canonicalImageId: "image", alt: "Chair" }, eligible: true, current: true }, { variantId: "variant-one", canonicalId: "canonical-chair", title: "Chair", canonicalLink: "/products/chair", image: { canonicalImageId: "image", alt: "Chair" }, eligible: true, current: true }] },
    { name: "missing IDs", variants: [] },
    { name: "duplicate canonical IDs", variants: [{ variantId: "variant-one", canonicalId: "canonical-chair", title: "Chair", canonicalLink: "/products/chair", image: { canonicalImageId: "image", alt: "Chair" }, eligible: true, current: true }, { variantId: "variant-two", canonicalId: "canonical-chair", title: "Chair 2", canonicalLink: "/products/chair-2", image: { canonicalImageId: "image-2", alt: "Chair 2" }, eligible: true, current: true }] },
  ])("rejects malformed or incomplete canonical data: $name", async ({ variants }) => {
    const answer = parseAnswer([{ type: "product_cards", variantIds: ["variant-one", "variant-two"] }]);

    await expect(resolvePublicChatAnswerWithCatalog(answer, { resolveVariants: async () => variants }, noHandoffDecision)).rejects.toBeInstanceOf(PublicChatResolutionError);
  });

  it("rejects stale or ineligible canonical variants", async () => {
    const answer = parseAnswer([{ type: "product_cards", variantIds: ["variant-one"] }]);

    await expect(resolvePublicChatAnswerWithCatalog(answer, { resolveVariants: async () => [{ variantId: "variant-one", canonicalId: "canonical-chair", title: "Chair", canonicalLink: "/products/chair", image: { canonicalImageId: "image", alt: "Chair" }, eligible: false, current: true }] }, noHandoffDecision)).rejects.toBeInstanceOf(PublicChatResolutionError);
  });

  it("rejects protocol-relative canonical links", async () => {
    const answer = parseAnswer([{ type: "product_cards", variantIds: ["variant-one"] }]);

    await expect(resolvePublicChatAnswerWithCatalog(answer, { resolveVariants: async () => [{ variantId: "variant-one", canonicalId: "canonical-chair", title: "Chair", canonicalLink: "//evil.example/chair", image: { canonicalImageId: "image", alt: "Chair" }, eligible: true, current: true }] }, noHandoffDecision)).rejects.toBeInstanceOf(PublicChatResolutionError);
  });

  it("converts non-Error canonical adapter failures into a typed safe error", async () => {
    const answer = parseAnswer([{ type: "product_cards", variantIds: ["variant-one"] }]);

    await expect(resolvePublicChatAnswerWithCatalog(answer, { resolveVariants: async () => { throw "secret"; } }, noHandoffDecision)).rejects.toMatchObject({ code: "canonical_adapter_error" });
  });
});

describe("public chat resolver references", () => {
  it("Given a model-invented recommendation request ID, When resolved, Then it cannot enter render-safe output", () => {
    const answer = parseAnswer([{ type: "recommendations", requestId: "model-invented-request" }]);

    const resolved = resolvePublicChatAnswer(answer, registries, noHandoffDecision);

    expect(resolved.blocks).toEqual([]);
  });

  it("Given unknown-only references, When resolved, Then no renderable records remain", () => {
    const answer = parseAnswer(
      [
        { type: "product_cards", variantIds: ["variant-unknown"] },
        { type: "comparison", variantIds: ["variant-one", "variant-unknown"], attributeKeys: ["material"] },
        { type: "image_gallery", canonicalImageIds: ["image-unknown"] },
        { type: "link_list", sourceIds: ["source-unknown"] },
      ],
      [{ sourceId: "source-unknown" }],
    );

    const resolved = resolvePublicChatAnswer(answer, registries, noHandoffDecision);

    expect(resolved.blocks).toEqual([]);
    expect(resolved.evidence).toEqual([]);
  });

  it("Given partial references, When resolved, Then list blocks retain known records and comparisons drop", () => {
    const answer = parseAnswer(
      [
        { type: "product_cards", variantIds: ["variant-one", "variant-unknown"] },
        { type: "comparison", variantIds: ["variant-one", "variant-unknown"], attributeKeys: ["material"] },
        { type: "image_gallery", canonicalImageIds: ["image-one", "image-unknown"] },
        { type: "link_list", sourceIds: ["source-one", "source-unknown"] },
      ],
      [{ sourceId: "source-one" }, { sourceId: "source-unknown" }],
    );

    const resolved = resolvePublicChatAnswer(answer, registries, noHandoffDecision);

    expect(resolved.blocks).toEqual([
      { type: "product_cards", products: [{ variantId: "variant-one", title: "One" }] },
      { type: "image_gallery", images: [{ canonicalImageId: "image-one", alt: "One image" }] },
      { type: "link_list", sources: [{ sourceId: "source-one", label: "One source" }] },
    ]);
    expect(resolved.evidence).toEqual([{ sourceId: "source-one", label: "One source" }]);
  });

  it("Given duplicate references, When resolved, Then server records are deterministically de-duplicated", () => {
    const answer = parseAnswer(
      [
        { type: "product_cards", variantIds: ["variant-one", "variant-one"] },
        { type: "comparison", variantIds: ["variant-one", "variant-one"], attributeKeys: ["material"] },
        { type: "image_gallery", canonicalImageIds: ["image-one", "image-one"] },
        { type: "link_list", sourceIds: ["source-one", "source-one"] },
      ],
      [{ sourceId: "source-one" }, { sourceId: "source-one" }],
    );

    const resolved = resolvePublicChatAnswer(answer, registries, noHandoffDecision);

    expect(resolved.blocks).toEqual([
      { type: "product_cards", products: [{ variantId: "variant-one", title: "One" }] },
      { type: "image_gallery", images: [{ canonicalImageId: "image-one", alt: "One image" }] },
      { type: "link_list", sources: [{ sourceId: "source-one", label: "One source" }] },
    ]);
    expect(resolved.evidence).toEqual([{ sourceId: "source-one", label: "One source" }]);
  });

  it.each([
    { type: "product_cards", variantIds: ["bad id"] },
    { type: "image_gallery", canonicalImageIds: ["https://invalid.example"] },
    { type: "link_list", sourceIds: ["source-one"], userId: "user-one" },
  ])("Given malformed reference block %o, When parsed, Then it is rejected before resolution", (block) => {
    const result = publicChatAnswerSchema.safeParse({
      text: "Public answer.",
      blocks: [block],
      evidence: [],
      followUps: [],
    });

    expect(result.success).toBe(false);
  });
});
