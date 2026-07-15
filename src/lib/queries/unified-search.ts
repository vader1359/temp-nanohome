import type { Locale } from "@/i18n/routing";
import type { Brand, Category, Designer, News } from "@/types/db";

import { getBrandsForVariants } from "./brands";
import { getCategories } from "./categories";
import { getDesignersForProducts } from "./designers";
import { searchNews } from "./news";
import { getVariantProductCount, getVariantProducts, type VariantProductListItem } from "./products";
import { normalizeSearchQuery } from "./search-input";

const SECTION_LIMIT = 6;

export type SearchSection<T> = Readonly<{
  items: readonly T[];
  hasError: boolean;
}>;

export type UnifiedSearchResults = Readonly<{
  query: string;
  products: SearchSection<VariantProductListItem>;
  brands: SearchSection<Brand>;
  categories: SearchSection<Category>;
  designers: SearchSection<Designer>;
  news: SearchSection<News>;
}>;

export { normalizeSearchQuery } from "./search-input";

function searchable(value: string | null | undefined, query: string): boolean {
  return typeof value === "string" && value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function matchCategories(categories: readonly Category[], query: string): readonly Category[] {
  return categories.filter((category) => [category.name, category.name_vi, category.name_ko, category.slug].some((value) => searchable(value, query))).slice(0, SECTION_LIMIT);
}

async function settledSection<T>(promise: Promise<readonly T[]>): Promise<SearchSection<T>> {
  const result = await promise.then((items) => ({ items, hasError: false as const }), () => ({ items: [] as const, hasError: true as const }));
  return result;
}

async function getAllMatchingVariantProducts(query: string): Promise<readonly VariantProductListItem[]> {
  const count = await getVariantProductCount({ search: query });
  if (count === 0) return [];

  return getVariantProducts({ search: query, page: 1, pageSize: count, sort: "priority" });
}

export async function unifiedSearch(value: string, locale: Locale): Promise<UnifiedSearchResults> {
  const query = normalizeSearchQuery(value);
  const empty = { items: [], hasError: false } as const;
  if (query === "") {
    return { query, products: empty, brands: empty, categories: empty, designers: empty, news: empty };
  }

  const products = await settledSection(
    getAllMatchingVariantProducts(query),
  );
  const brandIds = products.items.flatMap((variant) => variant.brand_id === null ? [] : [variant.brand_id]);
  const productIds = products.items.flatMap((variant) => variant.product_id === null ? [] : [variant.product_id]);
  const variantDesignerIds = products.items.flatMap((variant) => variant.designer_id === null ? [] : [variant.designer_id]);
  const [brands, categories, designers, news] = await Promise.all([
    settledSection(getBrandsForVariants({ productIds, variantBrandIds: brandIds })),
    settledSection(getCategories().then((items) => matchCategories(items, query))),
    settledSection(getDesignersForProducts({ productIds, variantDesignerIds })),
    settledSection(searchNews(query, locale, { pageSize: SECTION_LIMIT })),
  ]);

  return { query, products, brands, categories, designers, news };
}
