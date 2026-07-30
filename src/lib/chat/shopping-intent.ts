import { z } from "zod";

export const shoppingLocaleSchema = z.enum(["vi", "en", "ko"]);

const keySchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/u);
const boundedLimitSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
]);

export const shoppingCatalogSearchRequestSchema = z
  .object({
    searchText: z.string().trim().min(1).max(240).optional(),
    productFamilies: z.array(keySchema).max(4),
    subtypes: z.array(keySchema).max(8),
    categoryKeys: z.array(keySchema).max(12),
    collectionKeys: z.array(keySchema).max(8),
    roomKeys: z.array(keySchema).max(8),
    brandKeys: z.array(keySchema).max(8),
    designerKeys: z.array(keySchema).max(8),
    materialKeys: z.array(keySchema).max(8),
    colorKeys: z.array(keySchema).max(8),
    minPrice: z.number().finite().nonnegative().optional(),
    maxPrice: z.number().finite().nonnegative().optional(),
    availability: z.enum(["available_only", "include_unknown"]),
    sort: z.enum(["relevance", "price_asc", "price_desc", "priority"]),
    limit: boundedLimitSchema,
  })
  .strict()
  .refine(
    (value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice,
    "minPrice cannot exceed maxPrice",
  );

export type ShoppingCatalogSearchRequest = z.infer<typeof shoppingCatalogSearchRequestSchema>;
export type ShoppingLocale = z.infer<typeof shoppingLocaleSchema>;

export const productFamilyKeys = [
  "table",
  "desk",
  "lamp",
  "chair",
  "sofa",
  "bed",
  "cabinet",
  "mirror",
  "vase",
  "rug",
  "cushion",
  "accessory",
] as const;

export type ProductFamily = (typeof productFamilyKeys)[number];

export const shoppingIntentSchema = z
  .object({
    kind: z.enum([
      "product_search",
      "product_detail",
      "comparison",
      "recommendation",
      "policy",
      "clarification",
      "unsupported",
    ]),
    locale: shoppingLocaleSchema,
    searchText: z.string().trim().min(1).max(240).optional(),
    productFamilies: z.array(keySchema).max(4),
    subtypes: z.array(keySchema).max(8),
    categories: z.array(keySchema).max(12),
    rooms: z.array(keySchema).max(8),
    brands: z.array(keySchema).max(8),
    designers: z.array(keySchema).max(8),
    collections: z.array(keySchema).max(8),
    colors: z.array(keySchema).max(8),
    materials: z.array(keySchema).max(8),
    minPrice: z.number().finite().nonnegative().optional(),
    maxPrice: z.number().finite().nonnegative().optional(),
    availability: z.enum(["available_only", "include_unknown"]),
    sort: z.enum(["relevance", "price_asc", "price_desc", "priority"]),
    limit: boundedLimitSchema,
    ambiguity: z.array(z.string().trim().min(1).max(160)).max(3).optional(),
  })
  .strict()
  .refine(
    (value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice,
    "minPrice cannot exceed maxPrice",
  );

export type ShoppingIntent = z.infer<typeof shoppingIntentSchema>;

const familyWords: Readonly<Record<ProductFamily, readonly string[]>> = {
  table: ["table", "tables", "bàn", "ban"],
  desk: ["desk", "desks", "work desk", "bàn làm việc", "ban lam viec"],
  lamp: ["lamp", "lamps", "light", "lights", "đèn", "den", "đèn chiếu sáng", "den chieu sang"],
  chair: ["chair", "chairs", "ghế", "ghe"],
  sofa: ["sofa", "sofas"],
  bed: ["bed", "beds", "giường", "giuong"],
  cabinet: ["cabinet", "cabinets", "storage", "tủ", "tu", "tủ đồ", "tu do"],
  mirror: ["mirror", "mirrors", "gương", "guong"],
  vase: ["vase", "vases", "bình hoa", "binh hoa"],
  rug: ["rug", "rugs", "thảm", "tham"],
  cushion: ["cushion", "cushions", "gối", "goi"],
  accessory: ["accessory", "accessories", "phụ kiện", "phu kien", "nến", "nen"],
};

const stopWords = new Set([
  "cho", "tôi", "toi", "xem", "các", "cac", "mẫu", "mau", "hiện", "hien", "có", "co", "nào", "nao",
  "đẹp", "dep", "phù", "hop", "hợp", "một", "mot", "những", "nhung", "tìm", "tim", "giúp", "giup",
  "với", "voi", "về", "ve", "này", "nay", "nội", "noi", "thất", "that", "sản", "san", "phẩm", "pham",
  "the", "a", "an", "for", "me", "some", "show", "find", "please", "help", "the", "of", "and",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gu, "d")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function hasAny(text: string, values: readonly string[]): boolean {
  return values.some((value) => hasToken(text, value));
}

function hasToken(text: string, value: string): boolean {
  const normalized = normalizeText(value);
  const tokens = text.split(" ");
  const expected = normalized.split(" ");
  return expected.length === 1
    ? tokens.includes(normalized)
    : tokens.some((_, index) => expected.every((token, offset) => tokens[index + offset] === token));
}

function isNegated(text: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase);
  return new RegExp(`(?:khong|không|not|without|exclude|no)\\s+(?:phai|phải|need|want)?\\s*${normalizedPhrase}`, "iu").test(text);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function parseMoney(value: string, unit: string | undefined): number | undefined {
  const normalized = value.replace(/\s/gu, "");
  const numeric = normalized.includes(".") && normalized.split(".").length > 2
    ? Number(normalized.replace(/\./gu, "").replace(/,/gu, ""))
    : Number(normalized.replace(/,/gu, "."));
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  const normalizedUnit = unit?.toLocaleLowerCase();
  if (normalizedUnit === "ty" || normalizedUnit === "tỷ" || normalizedUnit === "b" || normalizedUnit === "billion") return numeric * 1_000_000_000;
  if (normalizedUnit === "tr" || normalizedUnit === "triệu" || normalizedUnit === "trieu" || normalizedUnit === "m" || normalizedUnit === "million") return numeric * 1_000_000;
  if (normalizedUnit === "k" || normalizedUnit === "nghin" || normalizedUnit === "nghìn") return numeric * 1_000;
  return numeric;
}

function priceBounds(text: string): Readonly<{ minPrice?: number; maxPrice?: number }> {
  const amount = "(\\d+(?:[.,]\\d+)?)";
  const unit = "(tỷ|ty|triệu|trieu|tr|million|billion|m|b|k|nghìn|nghin)?";
  const maxMatch = new RegExp(`(?:duoi|dưới|under|less than|toi da|tối đa|max(?:imum)?)\\s*${amount}\\s*${unit}`, "iu").exec(text);
  const minMatch = new RegExp(`(?:tu|từ|over|more than|tren|trên|at least|min(?:imum)?)\\s*${amount}\\s*${unit}`, "iu").exec(text);
  const maxPrice = maxMatch === null ? undefined : parseMoney(maxMatch[1] ?? "", maxMatch[2]);
  const minPrice = minMatch === null ? undefined : parseMoney(minMatch[1] ?? "", minMatch[2]);
  return { minPrice, maxPrice };
}

function exactIdentifier(question: string): string | undefined {
  const sku = /\bsku[-:#]?[a-z0-9][a-z0-9_-]{2,127}\b/iu.exec(question);
  if (sku?.[0] !== undefined) return sku[0];
  const match = /(?:mã sản phẩm|ma san pham|mã|ma|code|id)\s*[:#-]?\s*([a-z0-9][a-z0-9_-]{2,127})/iu.exec(question);
  return match?.[1];
}

function roomKeys(text: string): string[] {
  const rooms: string[] = [];
  if (hasAny(text, ["phòng khách", "phong khach", "living room", "living"])) rooms.push("living");
  if (hasAny(text, ["phòng ăn", "phong an", "dining room", "dining"])) rooms.push("dining");
  if (hasAny(text, ["phòng ngủ", "phong ngu", "bedroom", "bed room"])) rooms.push("bedroom");
  if (hasAny(text, ["phòng làm việc", "phong lam viec", "office", "workspace"])) rooms.push("office");
  if (hasAny(text, ["ban công", "ban cong", "balcony", "ngoài trời", "ngoai troi", "outdoor"])) rooms.push("outdoor");
  return unique(rooms);
}

function hasStandaloneTableWord(text: string): boolean {
  const withoutCompound = text
    .replace(/den ban|table lamp|ban lam viec|work desk|ghe ban an|dining chair/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return hasToken(withoutCompound, "ban") || hasToken(withoutCompound, "table") || hasToken(withoutCompound, "tables");
}

function productFamiliesFor(
  text: string,
  sourceText = text,
): Readonly<{ families: ProductFamily[]; subtypes: string[] }> {
  const families: ProductFamily[] = [];
  const subtypes: string[] = [];
  const tableLamp = hasAny(text, ["đèn bàn", "den ban", "table lamp"]);
  const positiveTableLamp = tableLamp && !isNegated(text, "den ban") && !isNegated(text, "table lamp");
  // Diacritic stripping turns "đèn" and the destination word "đến" into
  // the same token.  Only treat a bare `den` as a lamp when the original
  // question contains the accented lamp word or an unaccented lamp phrase.
  const explicitLamp = /\bđèn\b/iu.test(sourceText)
    || /\bden\s+(?:ban|bàn|chieu\s+sang|chiếu\s+sáng|trang\s+tri|trang\s+trí|treo|cay|cây)\b/iu.test(sourceText);
  const desk = hasAny(text, familyWords.desk);
  const explicitCabinet = /\btủ(?:\s+đồ)?\b|\btu\s+do\b|\bcabinets?\b|\bstorage\b/iu.test(sourceText);
  const explicitCushion = /\bgối\b|\bcushions?\b/iu.test(sourceText);
  const diningTable = hasAny(text, ["bàn ăn", "ban an", "dining table", "dining tables"]);
  const diningChair = hasAny(text, ["ghế bàn ăn", "ghe ban an", "dining chair", "dining chairs"]);
  const loungeChair = hasAny(text, ["ghế lounge", "ghe lounge", "lounge chair"]);

  if (tableLamp) {
    if (positiveTableLamp) {
      families.push("lamp");
      subtypes.push("table_lamp");
    }
  } else if (
    hasAny(text, ["lamp", "lamps", "light", "lights"])
    || explicitLamp
  ) {
    families.push("lamp");
  }
  if (desk && !isNegated(text, "desk") && !isNegated(text, "ban lam viec")) {
    families.push("desk");
    subtypes.push("work_desk");
  }
  if ((diningTable || hasStandaloneTableWord(text)) && !desk && !positiveTableLamp && !diningChair) {
    families.push("table");
    if (diningTable) subtypes.push("dining_table");
  }
  if (diningChair || loungeChair || hasAny(text, familyWords.chair)) {
    families.push("chair");
    if (diningChair) subtypes.push("dining_chair");
    if (loungeChair) subtypes.push("lounge_chair");
  }
  for (const family of productFamilyKeys) {
    if (families.includes(family) || ["table", "desk", "lamp", "chair"].includes(family)) continue;
    const matchesFamily = family === "cabinet"
      ? explicitCabinet
      : family === "cushion"
        ? explicitCushion
        : hasAny(text, familyWords[family]);
    if (matchesFamily) {
      families.push(family);
    }
  }
  return { families: unique(families) as ProductFamily[], subtypes: unique(subtypes) };
}

function filterKeys(text: string): Readonly<{
  brands: string[];
  designers: string[];
  collections: string[];
  colors: string[];
  materials: string[];
}> {
  const brands = ["usm", "cassina", "knoll", "vitra", "flos", "moooi"].filter((brand) => hasToken(text, brand));
  const designers = hasAny(text, ["le corbusier", "lecorbusier"])
    ? ["le_corbusier"]
    : [];
  const collections = (hasToken(text, "lc") || hasAny(text, ["lc collection", "bộ sưu tập lc", "bo suu tap lc"]))
    ? ["lc"]
    : [];
  // `den` is also the accentless spelling of `đèn`; only accept it as a
  // color when the query explicitly says black or "màu đen".
  const colors = hasAny(text, ["màu đen", "mau den", "black"])
    ? ["black"]
    : [];
  const materials = hasToken(text, "da") || hasAny(text, ["gỗ", "go", "gỗ sồi", "go soi", "leather", "wood", "oak"])
    ? [hasToken(text, "da") || hasAny(text, ["leather"]) ? "leather" : "wood"]
    : [];
  return { brands, designers, collections, colors, materials };
}

function categoryKeys(families: readonly ProductFamily[]): string[] {
  return unique(families);
}

function queryText(
  question: string,
  exactId: string | undefined,
  filters: Readonly<{ brands: readonly string[]; designers: readonly string[]; collections: readonly string[] }>,
  hasProductFamily: boolean,
  hasNonTextConstraint: boolean,
): string | undefined {
  if (exactId !== undefined) return exactId;
  const structured = [...filters.brands, ...filters.designers, ...filters.collections].join(" ");
  if (structured.length > 0) return structured;
  if (hasProductFamily || hasNonTextConstraint) return undefined;
  const tokens = normalizeText(question).split(" ").filter((token) => token.length > 1 && !stopWords.has(token));
  return tokens.length === 0 ? undefined : tokens.slice(0, 8).join(" ");
}

function isPolicyQuestion(text: string): boolean {
  return hasAny(text, ["giao hàng", "giao hang", "vận chuyển", "van chuyen", "bảo hành", "bao hanh", "đổi trả", "doi tra", "showroom", "liên hệ", "lien he", "delivery", "warranty", "returns", "contact"])
    || /(?:doi|đổi|exchange|return|refund).*(?:duoc|được|không|khong|can|có thể|co the)/iu.test(text);
}

function isPrivateOrUnsafe(text: string): boolean {
  return hasAny(text, ["prompt injection", "jailbreak", "ignore previous", "reveal system", "đơn hàng", "don hang", "tài khoản", "tai khoan", "customer data", "dữ liệu khách hàng", "du lieu khach hang"]);
}

function broadClarification(text: string, families: readonly ProductFamily[]): string[] {
  if (families.length > 1) return ["product_family_grouped_result"];
  if (hasAny(text, ["món nào hợp nhà tôi", "mon nao hop nha toi", "nội thất đẹp", "noi that dep", "loại nào tốt nhất", "loai nao tot nhat"])) {
    return ["product_family", "room", "budget"];
  }
  if (hasAny(text, ["dưới 120cm", "duoi 120cm", "small", "nhỏ", "nho"]) && families.length > 0) return ["verified_dimensions"];
  return [];
}

export function parseShoppingIntent(question: string, locale: ShoppingLocale): ShoppingIntent {
  const normalized = normalizeText(question);
  const exactId = exactIdentifier(question);
  const { families, subtypes } = productFamiliesFor(normalized, question);
  const rooms = roomKeys(normalized);
  const filters = filterKeys(normalized);
  const prices = priceBounds(normalized);
  const availability = hasAny(normalized, ["còn hàng", "con hang", "có sẵn", "co san", "available", "in stock"])
    ? "available_only"
    : "include_unknown";
  const sort = hasAny(normalized, ["rẻ nhất", "re nhat", "cheapest", "lowest price"])
    ? "price_asc"
    : hasAny(normalized, ["đắt nhất", "dat nhat", "most expensive", "highest price"])
      ? "price_desc"
      : "relevance";
  const hasNonTextConstraint = availability === "available_only"
    || prices.minPrice !== undefined
    || prices.maxPrice !== undefined
    || sort !== "relevance";
  const comparisons = hasAny(normalized, ["so sánh", "so sanh", "compare", "comparison"]);
  const policy = isPolicyQuestion(normalized);
  const unsafe = isPrivateOrUnsafe(normalized);
  const ambiguity = broadClarification(normalized, families);
  const kind = unsafe
    ? "unsupported"
    : policy
      ? "policy"
      : comparisons
        ? "comparison"
        : exactId !== undefined
          ? "product_detail"
          : ambiguity.length > 0
            ? "clarification"
            : families.length > 0
              || filters.brands.length > 0
              || filters.designers.length > 0
              || filters.collections.length > 0
              || hasNonTextConstraint
              ? hasAny(normalized, ["gợi ý", "goi y", "tư vấn", "tu van", "recommend", "suggest", "phù hợp", "phu hop"])
                ? "recommendation"
                : "product_search"
              : "clarification";
  const searchText = queryText(question, exactId, filters, families.length > 0, hasNonTextConstraint);
  const categories = categoryKeys(families);
  if (subtypes.includes("dining_table") || subtypes.includes("dining_chair")) rooms.push("dining");
  const parsed = {
    kind,
    locale,
    ...(searchText === undefined ? {} : { searchText }),
    productFamilies: families,
    subtypes,
    categories,
    rooms,
    brands: filters.brands,
    designers: filters.designers,
    collections: filters.collections,
    colors: filters.colors,
    materials: filters.materials,
    ...(prices.minPrice === undefined ? {} : { minPrice: prices.minPrice }),
    ...(prices.maxPrice === undefined ? {} : { maxPrice: prices.maxPrice }),
    availability,
    sort,
    limit: kind === "product_detail" ? 1 : kind === "comparison" ? 4 : 8,
    ...(ambiguity.length === 0 ? {} : { ambiguity }),
  } satisfies ShoppingIntent;
  return shoppingIntentSchema.parse(parsed);
}

export function shoppingIntentToCatalogRequest(intent: ShoppingIntent): ShoppingCatalogSearchRequest | undefined {
  if (intent.kind !== "product_search" && intent.kind !== "recommendation" && intent.kind !== "product_detail" && intent.kind !== "comparison") return undefined;
  const request = {
    ...(intent.searchText === undefined ? {} : { searchText: intent.searchText }),
    productFamilies: intent.productFamilies,
    subtypes: intent.subtypes,
    categoryKeys: intent.categories,
    collectionKeys: intent.collections,
    roomKeys: intent.rooms,
    brandKeys: intent.brands,
    designerKeys: intent.designers,
    materialKeys: intent.materials,
    colorKeys: intent.colors,
    ...(intent.minPrice === undefined ? {} : { minPrice: intent.minPrice }),
    ...(intent.maxPrice === undefined ? {} : { maxPrice: intent.maxPrice }),
    availability: intent.availability,
    sort: intent.sort,
    limit: intent.limit as ShoppingCatalogSearchRequest["limit"],
  } satisfies ShoppingCatalogSearchRequest;
  return shoppingCatalogSearchRequestSchema.parse(request);
}

export function shoppingIntentFingerprint(
  intent: ShoppingIntent,
  catalogRevision = "unknown",
): string {
  const request = shoppingIntentToCatalogRequest(intent);
  return JSON.stringify({
    catalogRevision,
    locale: intent.locale,
    kind: intent.kind,
    request,
    ambiguity: intent.ambiguity ?? [],
  });
}
