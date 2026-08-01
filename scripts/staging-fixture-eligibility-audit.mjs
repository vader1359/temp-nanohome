#!/usr/bin/env node

import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname.replace(/\/$/u, "");
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8")
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
      return match === null ? [] : [[match[1], match[2].replace(/^['"]|['"]$/gu, "")]];
    }),
);
const sku = process.argv.find((argument) => argument.startsWith("--sku="))
  ?.slice("--sku=".length)
  ?? "STG-AMIS-LWLFL00026-10K";
if (!/^[A-Za-z0-9._-]{1,120}$/u.test(sku)) throw new Error("invalid_fixture_sku");
const listCartReady = process.argv.includes("--list-cart-ready");
const auditBaseline = process.argv.includes("--baseline");
const auditDetails = process.argv.includes("--details");
const includeBaselineLines = process.argv.includes("--baseline-lines");
const baselineMatch = process.argv.find((argument) => argument.startsWith("--baseline-match="))
  ?.slice("--baseline-match=".length)
  .trim()
  .toLowerCase();
const serviceHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
};

async function readRows(path, searchParams) {
  const endpoint = new URL(`/rest/v1/${path}`, env.NEXT_PUBLIC_SUPABASE_URL);
  for (const [key, value] of Object.entries(searchParams)) endpoint.searchParams.set(key, value);
  const response = await fetch(endpoint, { headers: serviceHeaders });
  if (!response.ok) throw new Error(`staging_audit_read_failed_${path}_${response.status}`);
  return response.json();
}

async function readAllRows(path, searchParams) {
  const pageSize = 1_000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL(`/rest/v1/${path}`, env.NEXT_PUBLIC_SUPABASE_URL);
    for (const [key, value] of Object.entries(searchParams)) endpoint.searchParams.set(key, value);
    const response = await fetch(endpoint, {
      headers: {
        ...serviceHeaders,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
    });
    if (!response.ok) throw new Error(`staging_audit_read_failed_${path}_${response.status}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

if (auditBaseline) {
  const states = await readRows("amis_inventory_sync_state", {
    limit: "1",
    select: "active_baseline_id",
    sync_key: "eq.inventory",
  });
  const baselineId = states[0]?.active_baseline_id;
  if (typeof baselineId !== "string") throw new Error("active_inventory_baseline_missing");
  const [baselines, lines, catalogRows] = await Promise.all([
    readRows("amis_inventory_baselines", {
      id: `eq.${baselineId}`,
      select: "completed_at,is_active",
    }),
    readAllRows("amis_inventory_baseline_lines", {
      baseline_id: `eq.${baselineId}`,
      order: "sku.asc",
      select: "sku,stock",
    }),
    readAllRows("catalog_eligibility", {
      order: "sku.asc",
      select: "sku,stock,has_fresh_stock,catalog_approved_validated,reason_codes,cart,payment",
    }),
  ]);
  const baselineBySku = new Map(lines.map((line) => [line.sku, line]));
  const intersections = catalogRows
    .filter((row) => baselineBySku.has(row.sku))
    .map((row) => ({
      ...row,
      baselineStock: baselineBySku.get(row.sku)?.stock ?? null,
    }));
  const unmatchedCatalogRows = catalogRows.filter((row) => !baselineBySku.has(row.sku));
  const completedAt = baselines[0]?.completed_at;
  console.log(JSON.stringify({
    active: baselines[0]?.is_active === true,
    ageSeconds: typeof completedAt === "string"
      ? Math.max(0, Math.round((Date.now() - Date.parse(completedAt)) / 1_000))
      : null,
    catalogCount: catalogRows.length,
    intersectionCount: intersections.length,
    intersections,
    unmatchedCatalogCount: unmatchedCatalogRows.length,
    unmatchedCatalogRows,
    lineCount: lines.length,
    positiveStockCount: lines.filter((line) => Number(line.stock) > 0).length,
    ...(baselineMatch
      ? { matchedBaselineLines: lines.filter((line) => line.sku.toLowerCase().includes(baselineMatch)) }
      : {}),
    ...(includeBaselineLines ? { lines } : {}),
  }));
  process.exit(0);
}

if (auditDetails) {
  const variants = await readRows("variants", {
    sku: `eq.${sku}`,
    select: [
      "id",
      "product_id",
      "brand_id",
      "sku",
      "test_sku",
      "name",
      "name_vi",
      "slug",
      "price",
      "stock",
      "approved",
      "validated",
      "source_created_at",
      "source_updated_at",
      "created_at",
      "updated_at",
      "packshot_url",
      "gallery_urls",
      "raw",
    ].join(","),
  });
  const variant = variants[0];
  if (variant === undefined) throw new Error("fixture_variant_missing");
  const [products, brands] = await Promise.all([
    readRows("products", {
      id: `eq.${variant.product_id}`,
      select: "name,name_vi,slug,approved,validated",
    }),
    readRows("brands", {
      id: `eq.${variant.brand_id}`,
      select: "name,slug,approved,validated",
    }),
  ]);
  const raw = variant.raw !== null && typeof variant.raw === "object" && !Array.isArray(variant.raw)
    ? variant.raw
    : {};
  const rawSkuHints = Object.fromEntries(
    Object.entries(raw).filter(([key, value]) => (
      /(sku|source|fixture|test)/iu.test(key)
        && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    )),
  );
  console.log(JSON.stringify({
    variant: {
      ...variant,
      gallery_urls: Array.isArray(variant.gallery_urls) ? variant.gallery_urls.length : 0,
      packshot_url: typeof variant.packshot_url === "string",
      raw: rawSkuHints,
    },
    product: products[0] ?? null,
    brand: brands[0] ?? null,
  }));
  process.exit(0);
}

const url = new URL("/rest/v1/catalog_eligibility", env.NEXT_PUBLIC_SUPABASE_URL);
url.searchParams.set(listCartReady ? "cart" : "sku", listCartReady ? "eq.true" : `eq.${sku}`);
if (listCartReady) url.searchParams.set("limit", "20");
url.searchParams.set("select", [
  "sku",
  "stock",
  "price",
  "price_mode",
  "has_fresh_stock",
  "has_supported_media",
  "catalog_approved_validated",
  "hidden_brand_sku",
  "reason_codes",
  "storefront",
  "cart",
  "payment",
].join(","));

const response = await fetch(url, {
  headers: serviceHeaders,
});
if (!response.ok) throw new Error(`fixture_eligibility_read_failed_${response.status}`);
const rows = await response.json();
if (!Array.isArray(rows) || (!listCartReady && rows.length !== 1)) {
  throw new Error(`fixture_eligibility_row_count_${Array.isArray(rows) ? rows.length : "invalid"}`);
}
console.log(JSON.stringify(listCartReady ? rows : rows[0]));
