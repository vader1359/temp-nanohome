#!/usr/bin/env node

const CONCURRENCY = 8;
const EXPECTED_ORIGIN = "https://staging.nanohome.vn";
const PAGE_SIZE = 24;

async function fetchPage(locale, page) {
  const endpoint = new URL("/api/products", EXPECTED_ORIGIN);
  endpoint.searchParams.set("locale", locale);
  endpoint.searchParams.set("page", String(page));
  endpoint.searchParams.set("sort", "price_asc");
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(30_000) });
      lastStatus = response.status;
      if (response.ok) return await response.json();
    } catch {
      lastStatus = 0;
    }
  }
  throw new Error(`staging_catalog_page_failed_${locale}_${page}_${lastStatus}`);
}

async function fetchAllPages(locale) {
  const first = await fetchPage(locale, 1);
  const declaredCount = Number(first.totalCount);
  if (!Number.isSafeInteger(declaredCount) || declaredCount < 1) {
    throw new Error(`staging_catalog_count_invalid_${locale}`);
  }
  const pageCount = Math.ceil(declaredCount / PAGE_SIZE);
  const pages = [first];
  for (let start = 2; start <= pageCount; start += CONCURRENCY) {
    pages.push(...await Promise.all(Array.from(
      { length: Math.min(CONCURRENCY, pageCount - start + 1) },
      (_, index) => fetchPage(locale, start + index),
    )));
  }
  if (pages.some((page) => Number(page.totalCount) !== declaredCount)) {
    throw new Error(`staging_catalog_count_changed_during_audit_${locale}`);
  }
  const products = pages.flatMap((page) => page.products);
  const uniqueIds = new Set(products.map((product) => product.id));
  return {
    declaredCount,
    duplicateRows: products.length - uniqueIds.size,
    fetchedCount: products.length,
    invalidHrefs: products.filter((product) => (
      typeof product.href !== "string"
        || !product.href.startsWith("/products/")
    )).length,
    missingIds: products.filter((product) => typeof product.id !== "string" || product.id === "").length,
    missingNames: products.filter((product) => typeof product.name !== "string" || product.name.trim() === "").length,
    pageCount,
    uniqueIds: uniqueIds.size,
  };
}

const locales = Object.fromEntries(await Promise.all(
  ["vi", "en", "ko"].map(async (locale) => [locale, await fetchAllPages(locale)]),
));
const expectedCount = locales.vi.declaredCount;
const verified = Object.values(locales).every((audit) => (
  audit.declaredCount === expectedCount
    && audit.duplicateRows === 0
    && audit.fetchedCount === expectedCount
    && audit.invalidHrefs === 0
    && audit.missingIds === 0
    && audit.missingNames === 0
    && audit.uniqueIds === expectedCount
));

console.log(JSON.stringify({
  origin: EXPECTED_ORIGIN,
  pageSize: PAGE_SIZE,
  locales,
  sensitiveValuesPrinted: false,
  verified,
}));
process.exitCode = verified ? 0 : 1;
