#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const AMIS_PAGE_SIZE = 100;
const CONCURRENCY = 8;
const PRODUCTION_ORIGIN = "https://www.nanohome.vn";
const SOURCE_MARKER = "production-public-catalog+amis-readonly-2026-07-31";
const STAGING_PROJECT_REF = "xtjmwpeqarmsumjspnyw";
const applyRequested = process.argv.includes("--apply");
const confirmedStaging = process.argv.includes("--confirm-staging");
const prepareSync = process.argv.includes("--prepare-sync") || applyRequested;
const resolveDetails = process.argv.includes("--resolve-details") || prepareSync;
if (applyRequested && !confirmedStaging) throw new Error("staging_confirmation_required");
const root = new URL("../", import.meta.url).pathname.replace(/\/$/u, "");
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8")
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
      return match === null ? [] : [[match[1], match[2].replace(/^['"]|['"]$/gu, "")]];
    }),
);

function normalizeName(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi");
}

function parseVnd(value) {
  if (typeof value !== "string" || /liên hệ|contact/iu.test(value)) return null;
  const digits = value.replace(/\D/gu, "");
  return digits === "" ? null : Number(digits);
}

function deterministicUuid(value) {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value));
}

function absoluteHttpUrl(value) {
  try {
    const url = new URL(String(value ?? ""), PRODUCTION_ORIGIN);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function detailSlug(card) {
  try {
    const segments = new URL(card.href, PRODUCTION_ORIGIN).pathname.split("/").filter(Boolean);
    return decodeURIComponent(segments.at(-1) ?? String(card.id));
  } catch {
    return String(card.id);
  }
}

function stagingConfiguration() {
  const endpoint = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (
    env.SUPABASE_PROJECT_REF !== STAGING_PROJECT_REF
    || endpoint.hostname !== `${STAGING_PROJECT_REF}.supabase.co`
    || env.PAYMENT_MODE !== "sepay_sandbox"
    || env.SEPAY_ENV !== "sandbox"
    || !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("exact_staging_sandbox_target_not_proven");
  }
  return {
    baseUrl: endpoint.origin,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  };
}

async function stagingRequest(path, searchParams = {}, init = {}) {
  const config = stagingConfiguration();
  const endpoint = new URL(`/rest/v1/${path}`, config.baseUrl);
  for (const [key, value] of Object.entries(searchParams)) endpoint.searchParams.set(key, value);
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      ...config.headers,
      ...init.headers,
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`staging_catalog_request_failed_${path}_${response.status}`);
  const body = await response.text();
  return body === "" ? [] : JSON.parse(body);
}

async function stagingReadAll(path, searchParams) {
  const pageSize = 1_000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await stagingRequest(path, searchParams, {
      headers: { Range: `${offset}-${offset + pageSize - 1}` },
    });
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function insertMissingRows(path, rows) {
  const batchSize = 50;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    await stagingRequest(path, { on_conflict: "id" }, {
      body: JSON.stringify(rows.slice(offset, offset + batchSize)),
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      method: "POST",
    });
  }
}

async function fetchProductionPage(page) {
  const endpoint = new URL("/api/products", PRODUCTION_ORIGIN);
  endpoint.searchParams.set("locale", "vi");
  endpoint.searchParams.set("page", String(page));
  endpoint.searchParams.set("sort", "price_asc");
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(60_000) });
      lastStatus = response.status;
      if (response.ok) return await response.json();
    } catch {
      lastStatus = 0;
    }
  }
  throw new Error(`production_catalog_page_failed_${page}_${lastStatus}`);
}

async function fetchProductionCatalog() {
  const first = await fetchProductionPage(1);
  const pageCount = Math.ceil(Number(first.totalCount) / 24);
  const products = [...first.products];
  for (let start = 2; start <= pageCount; start += CONCURRENCY) {
    const pages = await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENCY, pageCount - start + 1) },
        (_, index) => fetchProductionPage(start + index),
      ),
    );
    products.push(...pages.flatMap((page) => page.products));
  }
  return {
    brands: first.brandOptions,
    categories: first.categoryOptions,
    declaredCount: Number(first.totalCount),
    products,
    rooms: first.roomOptions,
  };
}

async function fetchAmisToken() {
  const baseUrl = new URL(env.AMIS_API_BASE_URL);
  if (baseUrl.origin !== "https://crmconnect.misa.vn" || baseUrl.pathname !== "/") {
    throw new Error("amis_read_only_target_guard_failed");
  }
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(new URL("/api/v2/Account", baseUrl), {
        body: JSON.stringify({
          client_id: env.AMIS_CLIENT_ID,
          client_secret: env.AMIS_CLIENT_SECRET,
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(45_000),
      });
      lastStatus = response.status;
      if (response.ok) {
        const body = await response.json();
        if (body?.success === true && typeof body.data === "string") return body.data;
      }
    } catch {
      lastStatus = 0;
    }
  }
  throw new Error(`amis_token_read_failed_${lastStatus}`);
}

async function fetchAmisPage(page, token) {
  const endpoint = new URL("/api/v2/Products", env.AMIS_API_BASE_URL);
  endpoint.searchParams.set("page", String(page));
  endpoint.searchParams.set("pageSize", String(AMIS_PAGE_SIZE));
  endpoint.searchParams.set("orderBy", "modified_date");
  endpoint.searchParams.set("isDescending", "true");
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          Clientid: env.AMIS_CLIENT_ID,
        },
        signal: AbortSignal.timeout(60_000),
      });
      lastStatus = response.status;
      if (response.ok) {
        const body = await response.json();
        if (body?.success === true && Array.isArray(body.data)) return body.data;
      }
    } catch {
      lastStatus = 0;
    }
  }
  throw new Error(`amis_product_page_failed_${page}_${lastStatus}`);
}

async function fetchAmisCatalog() {
  const token = await fetchAmisToken();
  const products = [];
  for (let start = 0; ; start += CONCURRENCY) {
    const pages = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, index) => fetchAmisPage(start + index, token)),
    );
    const partialPage = pages.findIndex((page) => page.length < AMIS_PAGE_SIZE);
    const includedPages = partialPage === -1 ? pages : pages.slice(0, partialPage + 1);
    products.push(...includedPages.flat());
    if (partialPage !== -1) return products;
  }
}

function selectAmisMatch(card, candidates) {
  if (candidates.length === 1) return { kind: "unique_name", row: candidates[0] };
  const price = parseVnd(card.price);
  const byPrice = candidates.filter((row) => Number(row.unit_price) === price);
  if (byPrice.length === 1) return { kind: "unique_name_and_price", row: byPrice[0] };
  return { kind: candidates.length === 0 ? "unmatched" : "ambiguous", row: null };
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

async function fetchDetailSku(card) {
  const endpoint = new URL(`/vi/products/${encodeURIComponent(card.id)}`, PRODUCTION_ORIGIN);
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(60_000) });
      lastStatus = response.status;
      if (response.ok) {
        const html = await response.text();
        const matches = [...html.matchAll(/\\"id\\":\\"([^"\\]{1,128})\\",\\"sku\\":\\"([^"\\]{1,120})\\"/gu)];
        const exact = matches.find((match) => match[1].toLowerCase() === String(card.id).toLowerCase());
        if (exact !== undefined && exact[2].length <= 120) return { kind: "resolved", sku: exact[2] };
        const visibleSku = /<span[^>]*>SKU<\/span><div[^>]*><span[^>]*>([^<]{1,120})<\/span>/iu.exec(html)?.[1];
        if (visibleSku !== undefined) return { kind: "resolved", sku: visibleSku };
        return { kind: "sku_missing", sku: null };
      }
    } catch {
      lastStatus = 0;
    }
  }
  return { kind: `http_${lastStatus}`, sku: null };
}

async function prepareStagingSync({ amis, detailResults, production, resolutions }) {
  const cards = [...new Map(production.products.map((card) => [card.id, card])).values()];
  if (cards.length !== production.declaredCount || cards.some((card) => !isUuid(card.id))) {
    throw new Error("production_catalog_identity_guard_failed");
  }

  const skuByVariantId = new Map();
  for (const { card, resolution } of resolutions) {
    if (resolution.row !== null) skuByVariantId.set(card.id, resolution.row.product_code);
  }
  for (const { card, detail } of detailResults) {
    if (detail.kind === "resolved") skuByVariantId.set(card.id, detail.sku);
  }
  const missingSkuCount = cards.length - skuByVariantId.size;
  if (missingSkuCount > 2) throw new Error(`production_catalog_sku_guard_failed_${missingSkuCount}`);

  const [existingVariants, existingProducts, existingBrands, existingCategories, states] = await Promise.all([
    stagingReadAll("variants", { order: "id.asc", select: "id,product_id" }),
    stagingReadAll("products", { order: "id.asc", select: "id" }),
    stagingReadAll("brands", { order: "id.asc", select: "id,slug,approved,validated" }),
    stagingReadAll("categories", { order: "id.asc", select: "id,slug" }),
    stagingRequest("amis_inventory_sync_state", {
      limit: "1",
      select: "active_baseline_id",
      sync_key: "eq.inventory",
    }),
  ]);
  const baselineId = states[0]?.active_baseline_id;
  if (typeof baselineId !== "string") throw new Error("active_inventory_baseline_missing");
  const baselineLines = await stagingReadAll("amis_inventory_baseline_lines", {
    baseline_id: `eq.${baselineId}`,
    order: "sku.asc",
    select: "sku,stock",
  });

  const existingVariantIds = new Set(existingVariants.map((row) => row.id));
  const existingProductIds = new Set(existingProducts.map((row) => row.id));
  const existingBrandIds = new Set(existingBrands.map((row) => row.id));
  const existingCategoryIds = new Set(existingCategories.map((row) => row.id));
  const brandIdBySlug = new Map(
    existingBrands.filter((row) => typeof row.slug === "string").map((row) => [row.slug, row.id]),
  );
  const categoryIdBySlug = new Map(
    existingCategories.filter((row) => typeof row.slug === "string").map((row) => [row.slug, row.id]),
  );
  const newBrands = [];
  for (const brand of production.brands) {
    if (typeof brand.slug !== "string" || brand.slug === "") throw new Error("production_brand_slug_missing");
    if (brandIdBySlug.has(brand.slug)) continue;
    const sourceId = isUuid(brand.id) && !existingBrandIds.has(brand.id)
      ? brand.id
      : deterministicUuid(`${SOURCE_MARKER}:brand:${brand.slug}`);
    if (existingBrandIds.has(sourceId)) throw new Error("production_brand_id_conflict");
    brandIdBySlug.set(brand.slug, sourceId);
    existingBrandIds.add(sourceId);
    newBrands.push({
      approved: true,
      id: sourceId,
      logo_url: absoluteHttpUrl(brand.logoUrl),
      name: brand.name,
      slug: brand.slug,
      validated: true,
    });
  }

  const newRootCategories = [];
  for (const category of production.categories) {
    if (categoryIdBySlug.has(category.slug)) continue;
    const id = deterministicUuid(`${SOURCE_MARKER}:category:${category.slug}`);
    if (existingCategoryIds.has(id)) throw new Error("production_category_id_conflict");
    categoryIdBySlug.set(category.slug, id);
    existingCategoryIds.add(id);
    newRootCategories.push({
      approved: true,
      id,
      name: category.name,
      name_vi: category.name,
      parent_id: null,
      slug: category.slug,
      validated: true,
    });
  }
  const newSubCategories = [];
  for (const category of production.categories) {
    const parentId = categoryIdBySlug.get(category.slug);
    for (const subCategory of category.subCategories ?? []) {
      if (categoryIdBySlug.has(subCategory.slug)) continue;
      const id = deterministicUuid(`${SOURCE_MARKER}:category:${subCategory.slug}`);
      if (existingCategoryIds.has(id)) throw new Error("production_subcategory_id_conflict");
      categoryIdBySlug.set(subCategory.slug, id);
      existingCategoryIds.add(id);
      newSubCategories.push({
        approved: true,
        id,
        name: subCategory.name,
        name_vi: subCategory.name,
        parent_id: parentId,
        slug: subCategory.slug,
        validated: true,
      });
    }
  }

  const amisBySku = new Map(amis.map((row) => [row.product_code, row]));
  const stockBySku = new Map(baselineLines.map((row) => [row.sku, Number(row.stock)]));
  const roomLabelBySlug = new Map(production.rooms.map((room) => [room.slug, room.label]));
  const newCards = cards.filter((card) => !existingVariantIds.has(card.id));
  const productRows = [];
  const variantRows = [];

  for (const card of newCards) {
    const productId = deterministicUuid(`${SOURCE_MARKER}:product:${card.id}`);
    if (existingProductIds.has(productId)) throw new Error("production_product_id_conflict");
    existingProductIds.add(productId);
    const brandId = brandIdBySlug.get(card.brandSlug);
    if (brandId === undefined) throw new Error("production_card_brand_unresolved");
    const categoryId = categoryIdBySlug.get(card.subCategory)
      ?? categoryIdBySlug.get(card.category)
      ?? null;
    const sku = skuByVariantId.get(card.id) ?? null;
    const amisRow = sku === null ? undefined : amisBySku.get(sku);
    const stock = sku === null ? 0 : stockBySku.get(sku) ?? 0;
    const price = parseVnd(card.price);
    const compareAtPrice = parseVnd(card.oldPrice);
    const discountPercent = typeof card.discount === "string"
      ? Number(card.discount.replace(/\D/gu, "")) || null
      : null;
    const imageUrl = absoluteHttpUrl(card.imageUrl);
    if (imageUrl === null) throw new Error("production_card_media_unresolved");
    const slug = detailSlug(card);
    const rooms = Array.isArray(card.rooms) ? card.rooms.filter((room) => typeof room === "string") : [];
    const hasDiscount = price !== null && compareAtPrice !== null && compareAtPrice > price;

    productRows.push({
      approved: true,
      brand_id: brandId,
      category_id: categoryId,
      id: productId,
      media_image_url: imageUrl,
      name: card.name,
      name_vi: card.name,
      raw: { source: SOURCE_MARKER, production_variant_id: card.id },
      slug: `catalog-${card.id}`,
      slug_vi: `catalog-${card.id}`,
      validated: true,
    });
    variantRows.push({
      approved: true,
      brand_id: brandId,
      brand_name_denorm: card.brand,
      category_id: categoryId,
      cloudinary_ids: [],
      compare_at_price: hasDiscount ? compareAtPrice : null,
      discount_percent: hasDiscount ? discountPercent : null,
      filter_brand: card.brandSlug,
      filter_category: card.category ?? null,
      filter_is_new_arrival: false,
      filter_room: rooms,
      filter_room_vi: rooms.map((room) => roomLabelBySlug.get(room) ?? room),
      filter_sub_category: card.subCategory ?? null,
      gallery_urls: [],
      id: card.id,
      in_stock: stock > 0,
      name: card.name,
      name_vi: card.name,
      on_sale: hasDiscount,
      packshot_url: imageUrl,
      price,
      product_id: productId,
      product_name_denorm: card.name,
      raw: {
        price_mode: price === null ? "contact" : "fixed",
        production_variant_id: card.id,
        source: SOURCE_MARKER,
      },
      sku,
      slug,
      slug_vi: slug,
      source_created_at: amisRow?.created_date ?? null,
      source_updated_at: amisRow?.modified_date ?? null,
      stock,
      validated: true,
    });
  }

  const plan = {
    existingSourceVariants: cards.length - newCards.length,
    newBrands: newBrands.length,
    newRootCategories: newRootCategories.length,
    newSubCategories: newSubCategories.length,
    newProducts: productRows.length,
    newVariants: variantRows.length,
    newVariantsWithCategory: variantRows.filter((row) => row.filter_category !== null).length,
    newVariantsWithPositiveStock: variantRows.filter((row) => row.stock > 0).length,
    newVariantsWithRooms: variantRows.filter((row) => row.filter_room.length > 0).length,
    newVariantsWithSku: variantRows.filter((row) => row.sku !== null).length,
    sourceVariants: cards.length,
  };

  if (!applyRequested) return { applied: false, plan };
  await insertMissingRows("brands", newBrands);
  await insertMissingRows("categories", newRootCategories);
  await insertMissingRows("categories", newSubCategories);
  await insertMissingRows("products", productRows);
  await insertMissingRows("variants", variantRows);

  const [verifiedVariants, eligibility] = await Promise.all([
    stagingReadAll("variants", {
      order: "id.asc",
      select: "id,filter_brand,filter_category,filter_room,filter_sub_category",
    }),
    stagingReadAll("catalog_eligibility", {
      order: "variant_id.asc",
      select: "variant_id,cart,payment,storefront",
    }),
  ]);
  const sourceIds = new Set(cards.map((card) => card.id));
  const imported = verifiedVariants.filter((row) => sourceIds.has(row.id));
  if (imported.length !== cards.length) throw new Error("staging_catalog_verification_failed");
  return {
    applied: true,
    plan,
    verified: {
      cartReady: eligibility.filter((row) => row.cart === true).length,
      importedSourceVariants: imported.length,
      paymentReady: eligibility.filter((row) => row.payment === true).length,
      storefrontReady: eligibility.filter((row) => row.storefront === true).length,
      totalEligibilityRows: eligibility.length,
      totalVariants: verifiedVariants.length,
      variantsWithCategory: verifiedVariants.filter((row) => row.filter_category !== null).length,
      variantsWithRooms: verifiedVariants.filter((row) => Array.isArray(row.filter_room) && row.filter_room.length > 0).length,
    },
  };
}

const [production, amis] = await Promise.all([
  fetchProductionCatalog(),
  fetchAmisCatalog(),
]);
const productionUnique = new Map(production.products.map((row) => [row.id, row]));
const amisByName = new Map();
for (const row of amis) {
  const key = normalizeName(row.product_name);
  const rows = amisByName.get(key) ?? [];
  rows.push(row);
  amisByName.set(key, rows);
}

const resolutions = [...productionUnique.values()].map((card) => ({
  card,
  resolution: selectAmisMatch(card, amisByName.get(normalizeName(card.name)) ?? []),
}));
const resolved = resolutions.filter(({ resolution }) => resolution.row !== null);
const unresolved = resolutions.filter(({ resolution }) => resolution.row === null);
const detailResults = resolveDetails
  ? await mapConcurrent(unresolved, CONCURRENCY, async ({ card }) => ({
      card,
      detail: await fetchDetailSku(card),
    }))
  : [];
const amisBySku = new Map(amis.map((row) => [row.product_code, row]));
const detailResolved = detailResults.filter(({ detail }) => (
  detail.kind === "resolved" && amisBySku.has(detail.sku)
));
const detailParsed = detailResults.filter(({ detail }) => detail.kind === "resolved");
const detailKindCounts = Object.fromEntries(
  [...new Set(detailResults.map(({ detail }) => detail.kind))]
    .sort()
    .map((kind) => [kind, detailResults.filter(({ detail }) => detail.kind === kind).length]),
);
const stagingSync = prepareSync
  ? await prepareStagingSync({ amis, detailResults, production, resolutions })
  : null;

console.log(JSON.stringify({
  amis: {
    duplicateSkuRows: amis.length - new Set(amis.map((row) => row.product_code)).size,
    fetched: amis.length,
    uniqueNames: amisByName.size,
    uniqueSkus: new Set(amis.map((row) => row.product_code)).size,
  },
  production: {
    brands: production.brands.length,
    categories: production.categories.length,
    declared: production.declaredCount,
    duplicateRows: production.products.length - productionUnique.size,
    fetched: production.products.length,
    rooms: production.rooms.length,
    uniqueIds: productionUnique.size,
  },
  resolution: {
    ambiguous: resolutions.filter(({ resolution }) => resolution.kind === "ambiguous").length,
    exactUniqueName: resolutions.filter(({ resolution }) => resolution.kind === "unique_name").length,
    exactUniqueNameAndPrice: resolutions.filter(({ resolution }) => resolution.kind === "unique_name_and_price").length,
    resolved: resolved.length,
    detailAttempted: detailResults.length,
    detailKinds: detailKindCounts,
    detailParsed: detailParsed.length,
    detailParsedMissingFromAmis: detailParsed.length - detailResolved.length,
    detailResolvedAgainstAmis: detailResolved.length,
    fullyCrossCheckedAgainstAmis: resolved.length + detailResolved.length,
    fullyResolvedWithSku: resolved.length + detailParsed.length,
    resolvedWithCategory: resolved.filter(({ card }) => typeof card.category === "string" && card.category !== "").length,
    resolvedWithRooms: resolved.filter(({ card }) => Array.isArray(card.rooms) && card.rooms.length > 0).length,
    resolvedWithSubCategory: resolved.filter(({ card }) => typeof card.subCategory === "string" && card.subCategory !== "").length,
    unmatched: resolutions.filter(({ resolution }) => resolution.kind === "unmatched").length,
    unresolvedAfterDetails: resolveDetails
      ? productionUnique.size - resolved.length - detailParsed.length
      : unresolved.length,
  },
  sensitiveValuesPrinted: false,
  sources: ["production public catalog API", "AMIS read-only Products API"],
  stagingSync,
}));
