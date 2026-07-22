import { z } from "zod";

import type { PublicChatAnswer } from "./contracts";
import type { PublicChatPolicyDecision } from "./policy";
import type { PublicCatalogRecord } from "./tools/public-tools";

export type PublicChatProduct = {
  readonly variantId: string;
  readonly title: string;
  readonly canonicalId?: string;
  readonly canonicalLink?: string;
  readonly image?: PublicChatImage;
  readonly price?: PublicCatalogRecord["price"];
  readonly stock?: PublicCatalogRecord["stock"];
  readonly attributes?: Readonly<Record<string, string>>;
};

export type PublicChatSource = {
  readonly sourceId: string;
  readonly label: string;
};

export type PublicChatImage = {
  readonly canonicalImageId: string;
  readonly alt: string;
  readonly src?: string;
};

export type PublicChatServerRegistries = {
  readonly products: readonly PublicChatProduct[];
  readonly sources: readonly PublicChatSource[];
  readonly images: readonly PublicChatImage[];
};

export type RenderSafePublicChatBlock =
  | { readonly type: "product_cards"; readonly products: readonly PublicChatProduct[] }
  | {
      readonly type: "comparison";
      readonly products: readonly PublicChatProduct[];
      readonly attributeKeys: readonly ("dimensions" | "material" | "finish" | "color" | "brand" | "category" | "product" | "designer" | "collection" | "description" | "designer_description")[];
    }
  | { readonly type: "image_gallery"; readonly images: readonly PublicChatImage[] }
  | { readonly type: "link_list"; readonly sources: readonly PublicChatSource[] }
  | { readonly type: "staff_handoff"; readonly reasonCode: "unsupported_request" | "staff_confirmation_required" };

export type RenderSafePublicChatAnswer = {
  readonly text: string;
  readonly blocks: readonly RenderSafePublicChatBlock[];
  readonly evidence: readonly PublicChatSource[];
  readonly followUps: readonly string[];
};

export type PublicChatCanonicalVariant = {
  readonly variantId: string;
  readonly canonicalId: string;
  readonly title: string;
  readonly canonicalLink: string;
  readonly image: PublicChatImage;
  readonly eligible: boolean;
  readonly current: boolean;
};

export type PublicChatCanonicalVariantAdapter = {
  readonly resolveVariants: (variantIds: readonly string[]) => Promise<readonly PublicChatCanonicalVariant[]>;
};

export class PublicChatResolutionError extends Error {
  readonly code: "canonical_adapter_error" | "invalid_canonical_data";

  constructor(code: "canonical_adapter_error" | "invalid_canonical_data") {
    super(code);
    this.name = "PublicChatResolutionError";
    this.code = code;
  }
}

const identifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
const canonicalVariantSchema = z.object({
  variantId: identifierSchema,
  canonicalId: identifierSchema,
  title: z.string().min(1).max(1_000).refine(isRenderSafeText),
  canonicalLink: z.string().min(2).max(2_000).regex(/^\/(?!\/)/),
  image: z.object({ canonicalImageId: identifierSchema, alt: z.string().min(1).max(1_000).refine(isRenderSafeText), src: z.string().min(2).max(2_000).optional() }).strict(),
  eligible: z.boolean(),
  current: z.boolean(),
}).strict();

function isRenderSafeText(value: string): boolean {
  return !/<[^>]*>|!\[[^\]]*\]\([^)]*\)|\bhttps?:\/\/|\bftp:\/\/|\bjavascript:/i.test(value);
}

function parseCanonicalVariants(variants: readonly PublicChatCanonicalVariant[], requestedIds: readonly string[]): readonly PublicChatCanonicalVariant[] {
  const parsed = z.array(canonicalVariantSchema).parse(variants);
  const requested = new Set(requestedIds);
  const variantIds = new Set<string>();
  const canonicalIds = new Set<string>();
  const imageIds = new Set<string>();
  if (parsed.length !== requestedIds.length) throw new PublicChatResolutionError("invalid_canonical_data");
  for (const variant of parsed) {
    if (!requested.has(variant.variantId) || variantIds.has(variant.variantId) || canonicalIds.has(variant.canonicalId) || imageIds.has(variant.image.canonicalImageId) || !variant.eligible || !variant.current) {
      throw new PublicChatResolutionError("invalid_canonical_data");
    }
    variantIds.add(variant.variantId);
    canonicalIds.add(variant.canonicalId);
    imageIds.add(variant.image.canonicalImageId);
  }
  return parsed;
}

function uniqueProducts(variantIds: readonly string[], registries: PublicChatServerRegistries): readonly PublicChatProduct[] {
  const seen = new Set<string>();
  return variantIds.flatMap((variantId) => {
    if (seen.has(variantId)) return [];
    seen.add(variantId);
    const product = registries.products.find((candidate) => candidate.variantId === variantId);
    return product === undefined ? [] : [product];
  });
}

function uniqueSources(sourceIds: readonly string[], registries: PublicChatServerRegistries): readonly PublicChatSource[] {
  const seen = new Set<string>();
  return sourceIds.flatMap((sourceId) => {
    if (seen.has(sourceId)) return [];
    seen.add(sourceId);
    const source = registries.sources.find((candidate) => candidate.sourceId === sourceId);
    return source === undefined ? [] : [source];
  });
}

function uniqueImages(canonicalImageIds: readonly string[], registries: PublicChatServerRegistries): readonly PublicChatImage[] {
  const seen = new Set<string>();
  return canonicalImageIds.flatMap((canonicalImageId) => {
    if (seen.has(canonicalImageId)) return [];
    seen.add(canonicalImageId);
    const image = registries.images.find((candidate) => candidate.canonicalImageId === canonicalImageId);
    return image === undefined ? [] : [image];
  });
}

function resolveBlock(
  block: PublicChatAnswer["blocks"][number],
  registries: PublicChatServerRegistries,
  policyDecision: PublicChatPolicyDecision,
): readonly RenderSafePublicChatBlock[] {
  switch (block.type) {
    case "product_cards": {
      const products = uniqueProducts(block.variantIds, registries);
      return products.length === 0 ? [] : [{ type: "product_cards", products }];
    }
    case "comparison": {
      const uniqueVariantIds = [...new Set(block.variantIds)];
      const products = uniqueProducts(uniqueVariantIds, registries);
      return uniqueVariantIds.length >= 2 && products.length === uniqueVariantIds.length
        ? [{ type: "comparison", products, attributeKeys: block.attributeKeys }]
        : [];
    }
    case "image_gallery": {
      const images = uniqueImages(block.canonicalImageIds, registries);
      return images.length === 0 ? [] : [{ type: "image_gallery", images }];
    }
    case "recommendations":
      return [];
    case "link_list": {
      const sources = uniqueSources(block.sourceIds, registries);
      return sources.length === 0 ? [] : [{ type: "link_list", sources }];
    }
    case "staff_handoff":
      return policyDecision.kind === "handoff" && policyDecision.reasonCode === block.reasonCode
        ? [{ type: "staff_handoff", reasonCode: block.reasonCode }]
        : [];
  }
}

export function resolvePublicChatAnswer(
  answer: PublicChatAnswer,
  registries: PublicChatServerRegistries,
  policyDecision: PublicChatPolicyDecision,
): RenderSafePublicChatAnswer {
  return {
    text: answer.text,
    blocks: answer.blocks.flatMap((block) => resolveBlock(block, registries, policyDecision)),
    evidence: uniqueSources(answer.evidence.map(({ sourceId }) => sourceId), registries),
    followUps: answer.followUps,
  };
}

export async function resolvePublicChatAnswerWithCatalog(
  answer: PublicChatAnswer,
  adapter: PublicChatCanonicalVariantAdapter,
  policyDecision: PublicChatPolicyDecision,
): Promise<RenderSafePublicChatAnswer> {
  const variantIds = answer.blocks.flatMap((block) => (block.type === "product_cards" || block.type === "comparison" ? block.variantIds : []));
  const requestedVariantIds = [...new Set(variantIds)];
  let canonicalVariants: readonly PublicChatCanonicalVariant[];
  try {
    canonicalVariants = parseCanonicalVariants(await adapter.resolveVariants(requestedVariantIds), requestedVariantIds);
  } catch (error) {
    if (error instanceof PublicChatResolutionError) throw error;
    if (error instanceof z.ZodError) throw new PublicChatResolutionError("invalid_canonical_data");
    throw new PublicChatResolutionError("canonical_adapter_error");
  }
  const registries: PublicChatServerRegistries = {
    products: canonicalVariants.map((variant) => ({
      variantId: variant.variantId,
      title: variant.title,
      canonicalId: variant.canonicalId,
      canonicalLink: variant.canonicalLink,
      image: variant.image.src === undefined
        ? { canonicalImageId: variant.image.canonicalImageId, alt: variant.image.alt }
        : { canonicalImageId: variant.image.canonicalImageId, alt: variant.image.alt, src: variant.image.src },
    })),
    sources: [],
    images: canonicalVariants.map(({ image }) => image.src === undefined
      ? { canonicalImageId: image.canonicalImageId, alt: image.alt }
      : { canonicalImageId: image.canonicalImageId, alt: image.alt, src: image.src },
    ),
  };
  return resolvePublicChatAnswer(answer, registries, policyDecision);
}
