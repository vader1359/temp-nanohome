import { z } from "zod";

const priceModeSchema = z.union([z.literal("fixed"), z.literal("contact"), z.literal("deposit"), z.literal("unavailable")]);
const eligibilityRowSchema = z.object({
  variant_id: z.string().min(1),
  product_id: z.string().min(1).nullable(),
  brand_id: z.string().min(1).nullable(),
  sku: z.string().nullable(),
  variant_slug: z.string().nullable(),
  variant_name: z.string().nullable(),
  localized_name: z.string().nullable(),
  product_slug: z.string().nullable(),
  product_name: z.string().nullable(),
  localized_product_name: z.string().nullable(),
  brand_slug: z.string().nullable(),
  brand_name: z.string().nullable(),
  image_url: z.string().url().nullable(),
  price: z.number().nullable(),
  stock: z.number().nullable(),
  price_mode: priceModeSchema,
  has_fresh_stock: z.boolean(),
  has_supported_media: z.boolean(),
  catalog_approved_validated: z.boolean(),
  hidden_brand_sku: z.boolean(),
  reason_codes: z.array(z.string().min(1)),
  storefront: z.boolean(),
  recommendation: z.boolean(),
  visual_match: z.boolean(),
  cart: z.boolean(),
  payment: z.boolean(),
}).strict();

export type CatalogEligibility = Readonly<z.infer<typeof eligibilityRowSchema>>;
export type CatalogEligibilityCapability = "storefront" | "recommendation" | "visual_match" | "cart" | "payment";

export function parseCatalogEligibilityRow(input: unknown): CatalogEligibility { return eligibilityRowSchema.parse(input); }
export function isCatalogEligibleFor(row: CatalogEligibility, capability: CatalogEligibilityCapability): boolean { return row[capability]; }
export function isStorefrontEligible(row: CatalogEligibility): boolean { return row.storefront; }
export function isRecommendationEligible(row: CatalogEligibility): boolean { return row.recommendation; }
export function isVisualMatchEligible(row: CatalogEligibility): boolean { return row.visual_match; }
export function isCartEligible(row: CatalogEligibility): boolean { return row.cart; }
export function isPaymentEligible(row: CatalogEligibility): boolean { return row.payment; }
