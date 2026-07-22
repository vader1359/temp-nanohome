import { z } from "zod";

import { parseCatalogEligibilityRow } from "@/lib/catalog/eligibility";
import { parseRawSku, type RawSku } from "./domain";

const selectionSchema = z.object({
  id: z.string().min(1).max(128),
  quantity: z.number().int().min(1).max(99),
});

const selectionsSchema = z.array(selectionSchema).min(1).max(50).superRefine((selections, context) => {
  const seen = new Set<string>();
  selections.forEach((selection, index) => {
    if (seen.has(selection.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate variant",
        path: [index, "id"],
      });
    }
    seen.add(selection.id);
  });
});

export type CatalogEligibilityReader = (
  variantIds: readonly string[],
) => Promise<readonly unknown[]>;

export type CanonicalOrderRequestItem = Readonly<{
  variantId: string;
  sku: RawSku;
  name: string;
  category: string | null;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
}>;

export type CanonicalOrderRequest = Readonly<{
  items: readonly CanonicalOrderRequestItem[];
  totalAmount: number;
}>;

export type ResolveOrderRequestResult =
  | Readonly<{ kind: "success"; orderRequest: CanonicalOrderRequest }>
  | Readonly<{ kind: "invalid_payload" | "invalid_selection" }>;

export async function resolveOrderRequestCatalog(
  readEligibility: CatalogEligibilityReader,
  input: unknown,
): Promise<ResolveOrderRequestResult> {
  const parsedSelections = selectionsSchema.safeParse(input);
  if (!parsedSelections.success) return { kind: "invalid_payload" };

  const rows = await readEligibility(parsedSelections.data.map((selection) => selection.id));
  const eligibilityById = new Map(
    rows.map((row) => {
      const eligibility = parseCatalogEligibilityRow(row);
      return [eligibility.variant_id, eligibility] as const;
    }),
  );

  if (eligibilityById.size !== parsedSelections.data.length) {
    return { kind: "invalid_selection" };
  }

  const items: CanonicalOrderRequestItem[] = [];
  for (const selection of parsedSelections.data) {
    const eligibility = eligibilityById.get(selection.id);
    if (
      eligibility === undefined
      || !eligibility.cart
      || eligibility.price_mode !== "fixed"
      || eligibility.price === null
      || eligibility.price <= 0
      || eligibility.stock === null
      || eligibility.stock < selection.quantity
      || eligibility.sku === null
    ) {
      return { kind: "invalid_selection" };
    }

    const sku = parseRawSku(eligibility.sku);
    const name = eligibility.localized_name
      ?? eligibility.variant_name
      ?? eligibility.localized_product_name
      ?? eligibility.product_name
      ?? sku;
    const categoryParts = [eligibility.brand_name, eligibility.localized_product_name]
      .filter((part): part is string => part !== null && part.trim().length > 0);

    items.push({
      variantId: eligibility.variant_id,
      sku,
      name,
      category: categoryParts.length > 0 ? categoryParts.join(" / ") : null,
      quantity: selection.quantity,
      unitAmount: eligibility.price,
      lineTotal: eligibility.price * selection.quantity,
    });
  }

  return {
    kind: "success",
    orderRequest: {
      items,
      totalAmount: items.reduce((total, item) => total + item.lineTotal, 0),
    },
  };
}
