import type { AmisStockLedgerRecord } from "@/lib/amis/client";
import type { Tables, TablesUpdate, TypedSupabaseClient } from "@/types/db";

const VARIANT_WRITE_CONCURRENCY = 10;
const VARIANT_READ_PAGE_SIZE = 1_000;

type StockSyncInput = {
  readonly supabase: TypedSupabaseClient;
  readonly records: readonly AmisStockLedgerRecord[];
};

export type StockSyncResult = {
  readonly itemsProcessed: number;
  readonly itemsFailed: number;
  readonly error: string | null;
};

type LocalVariant = Pick<Tables<"variants">, "id" | "sku" | "stock">;

export async function syncAmisStockSnapshot(input: StockSyncInput): Promise<StockSyncResult> {
  const variants = await readLocalVariants(input.supabase);
  if (variants.kind === "failure") {
    return { itemsProcessed: 0, itemsFailed: 1, error: variants.error };
  }

  const updates = stockUpdates(input.records, variants.data);
  let itemsProcessed = 0;
  let itemsFailed = 0;
  let lastError: string | null = null;

  for (let start = 0; start < updates.length; start += VARIANT_WRITE_CONCURRENCY) {
    const batch = updates.slice(start, start + VARIANT_WRITE_CONCURRENCY);
    const results = await Promise.all(batch.map(async (update) => ({
      result: await input.supabase.from("variants")
        .update({ stock: update.stock } satisfies TablesUpdate<"variants">, { count: "exact" })
        .eq("id", update.id),
    })));

    for (const { result } of results) {
      if (result.error !== null || result.count === 0) {
        itemsFailed += 1;
        lastError = result.error?.message ?? "No Supabase variant matched AMIS stock update";
      } else {
        itemsProcessed += 1;
      }
    }
  }

  return { itemsProcessed, itemsFailed, error: lastError };
}

type LocalVariantRead =
  | { readonly kind: "success"; readonly data: readonly LocalVariant[] }
  | { readonly kind: "failure"; readonly error: string };

async function readLocalVariants(supabase: TypedSupabaseClient): Promise<LocalVariantRead> {
  const variants: LocalVariant[] = [];

  for (let from = 0; ; from += VARIANT_READ_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("variants")
      .select("id, sku, stock")
      .range(from, from + VARIANT_READ_PAGE_SIZE - 1);

    if (error !== null) return { kind: "failure", error: error.message };

    const page = data ?? [];
    variants.push(...page);
    if (page.length < VARIANT_READ_PAGE_SIZE) return { kind: "success", data: variants };
  }
}

type StockUpdate = { readonly id: string; readonly stock: number };

function stockUpdates(
  records: readonly AmisStockLedgerRecord[],
  variants: readonly LocalVariant[],
): readonly StockUpdate[] {
  const variantsBySku = uniqueVariantsBySku(variants);
  return records.flatMap((record) => {
    const variant = variantsBySku.get(record.sku);
    if (variant === undefined || variant.stock === record.stock) return [];
    return [{ id: variant.id, stock: record.stock }];
  });
}

function uniqueVariantsBySku(variants: readonly LocalVariant[]): ReadonlyMap<string, LocalVariant> {
  const variantsBySku = new Map<string, LocalVariant>();
  const duplicateSkus = new Set<string>();

  for (const variant of variants) {
    if (variant.sku === null) continue;
    if (variantsBySku.has(variant.sku)) {
      variantsBySku.delete(variant.sku);
      duplicateSkus.add(variant.sku);
    } else if (!duplicateSkus.has(variant.sku)) {
      variantsBySku.set(variant.sku, variant);
    }
  }

  return variantsBySku;
}
