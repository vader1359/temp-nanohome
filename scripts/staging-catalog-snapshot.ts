import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const EXPECTED_PROJECT_REF = "xtjmwpeqarmsumjspnyw";
const SNAPSHOT_ROOT =
  "/Users/iant1359/Develop/temp-nanohome/outputs/missing-sku-enrichment";
const BRAND_SNAPSHOT =
  "/Users/iant1359/Develop/temp-nanohome/outputs/supabase-backup/2026-07-19T22-18-39-044Z/brands.json";
const SNAPSHOT_SIZE = 50;

type JsonRecord = Record<string, unknown>;

function parseEnvFile(path: string) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match === null) return [];
        const raw = match[2].trim();
        const value = raw.startsWith("\"") && raw.endsWith("\"")
          ? JSON.parse(raw)
          : raw.replace(/^'|'$/g, "");
        return [[match[1], value] as const];
      }),
  );
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function encodePathSegment(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

async function requestJson(
  url: string,
  headers: Record<string, string>,
): Promise<JsonRecord[]> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Staging catalog read failed (${response.status}).`);
  return response.json() as Promise<JsonRecord[]>;
}

async function upsert(
  baseUrl: string,
  table: string,
  rows: JsonRecord[],
  headers: Record<string, string>,
) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?on_conflict=id`, {
    body: JSON.stringify(rows),
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    method: "POST",
  });
  if (!response.ok) throw new Error(`Staging ${table} upsert failed (${response.status}).`);
}

async function countTable(
  baseUrl: string,
  table: string,
  headers: Record<string, string>,
) {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=id`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (!response.ok) throw new Error(`Staging ${table} count failed (${response.status}).`);
  return Number(response.headers.get("content-range")?.split("/")[1] ?? "0");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const env = parseEnvFile(".env.local");
  const targetHost = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  if (
    env.SUPABASE_PROJECT_REF !== EXPECTED_PROJECT_REF
    || targetHost !== `${EXPECTED_PROJECT_REF}.supabase.co`
  ) {
    throw new Error("Refusing catalog operation: exact Supabase staging target was not proven.");
  }

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!serviceKey || !publicKey) throw new Error("Required staging Supabase keys are absent.");
  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
  const publicHeaders = {
    apikey: publicKey,
    Authorization: `Bearer ${publicKey}`,
  };

  const draft = readJson<{ rows: JsonRecord[] }>(
    `${SNAPSHOT_ROOT}/missing-sku-enrichment-draft.json`,
  );
  const report = readJson<{ rows: JsonRecord[] }>(`${SNAPSHOT_ROOT}/apply-report.json`);
  const sourceBrands = readJson<JsonRecord[]>(BRAND_SNAPSHOT);
  const draftBySku = new Map(draft.rows.map((row) => [String(row.sku), row]));
  const selected = report.rows
    .filter((row) => {
      const source = draftBySku.get(String(row.sku));
      return source?.misa_name && source.misa_image_url;
    })
    .sort((left, right) => String(left.sku).localeCompare(String(right.sku)))
    .slice(0, SNAPSHOT_SIZE);
  if (selected.length !== SNAPSHOT_SIZE) {
    throw new Error(`Verified source has ${selected.length}/${SNAPSHOT_SIZE} required rows.`);
  }

  const neededBrandNames = new Set(
    selected.map((row) =>
      String(draftBySku.get(String(row.sku))?.brand_guess).toLocaleLowerCase()),
  );
  const brands = sourceBrands
    .filter((brand) => neededBrandNames.has(String(brand.name).toLocaleLowerCase()))
    .map((brand) => ({
      airtable_id: brand.airtable_id,
      approved: true,
      description: brand.description,
      description_ko: brand.description_ko,
      description_vi: brand.description_vi,
      id: brand.id,
      logo_url: brand.logo_url,
      meta_description: brand.meta_description,
      meta_title: brand.meta_title,
      name: brand.name,
      origin: brand.origin,
      origin_ko: brand.origin_ko,
      origin_vi: brand.origin_vi,
      slug: brand.slug,
      validated: true,
    }));
  if (brands.length !== neededBrandNames.size) {
    throw new Error("A required exact source brand is absent.");
  }
  const brandByName = new Map(
    brands.map((brand) => [String(brand.name).toLocaleLowerCase(), brand]),
  );

  const products: JsonRecord[] = [];
  const variants: JsonRecord[] = [];
  for (const row of selected) {
    const source = draftBySku.get(String(row.sku));
    if (!source) throw new Error("Source row disappeared during snapshot construction.");
    const brand = brandByName.get(String(source.brand_guess).toLocaleLowerCase());
    if (!brand) throw new Error("Exact source brand mapping failed.");
    const localImages = (source.local_images as string[])
      .filter((file) => /\.(?:avif|jpe?g|png|webp)$/i.test(file))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const packshot = localImages.find((file) => /packshot/i.test(file));
    if (!packshot) throw new Error("Verified source row has no packshot.");
    const mediaOrigin = new URL(String(row.packshotUrl)).origin;
    const orderedImages = [packshot, ...localImages.filter((file) => file !== packshot)];
    const urls = orderedImages.map(
      (file) =>
        `${mediaOrigin}/product-images/${String(row.sku)}/${encodePathSegment(file)}`,
    );
    if (
      urls[0] !== row.packshotUrl
      || urls.length - 1 !== Number(row.galleryCount)
    ) {
      throw new Error("Source media manifest does not match the verified apply report.");
    }
    const slug = String(row.sku).toLocaleLowerCase();
    const sourceRef = {
      manifest: "verified-missing-sku-enrichment-2026-07-26",
      sku: row.sku,
    };
    products.push({
      approved: true,
      brand_id: brand.id,
      id: row.productId,
      media_image_url: urls[0],
      name: source.misa_name,
      name_vi: source.misa_name,
      raw: sourceRef,
      slug,
      slug_vi: slug,
      validated: true,
    });
    variants.push({
      approved: true,
      brand_id: brand.id,
      brand_name_denorm: brand.name,
      cloudinary_ids: [],
      filter_brand: brand.slug,
      gallery_urls: urls.slice(1),
      id: row.variantId,
      in_stock: false,
      name: source.misa_name,
      name_vi: source.misa_name,
      on_sale: false,
      packshot_url: urls[0],
      product_id: row.productId,
      product_name_denorm: source.misa_name,
      raw: { ...sourceRef, price_mode: "contact" },
      sku: row.sku,
      slug,
      slug_vi: slug,
      stock: 0,
      validated: true,
    });
  }

  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
  const skuFilter = variants.map((variant) => encodeURIComponent(String(variant.sku))).join(",");
  const productIds = products.map((product) => String(product.id));
  const variantIds = variants.map((variant) => String(variant.id));
  const slugs = products.map((product) => encodeURIComponent(String(product.slug)));
  const [existingSkus, existingProductIds, existingVariantIds, existingSlugs] =
    await Promise.all([
      requestJson(
        `${baseUrl}/rest/v1/variants?select=id,sku&sku=in.(${skuFilter})`,
        serviceHeaders,
      ),
      requestJson(
        `${baseUrl}/rest/v1/products?select=id&id=in.(${productIds.join(",")})`,
        serviceHeaders,
      ),
      requestJson(
        `${baseUrl}/rest/v1/variants?select=id&id=in.(${variantIds.join(",")})`,
        serviceHeaders,
      ),
      requestJson(
        `${baseUrl}/rest/v1/products?select=id,slug&slug=in.(${slugs.join(",")})`,
        serviceHeaders,
      ),
    ]);
  const existingRows = new Set([
    ...existingSkus.map((row) => String(row.id)),
    ...existingProductIds.map((row) => String(row.id)),
    ...existingVariantIds.map((row) => String(row.id)),
    ...existingSlugs.map((row) => String(row.id)),
  ]);
  if (existingRows.size > 0 && existingRows.size !== SNAPSHOT_SIZE * 2) {
    throw new Error("Partial or conflicting staging snapshot detected; refusing broad upsert.");
  }

  const before = {
    products: await countTable(baseUrl, "products", serviceHeaders),
    variants: await countTable(baseUrl, "variants", serviceHeaders),
  };
  const mediaStatuses = await Promise.all(
    variants.map((variant) =>
      fetch(String(variant.packshot_url), { method: "HEAD" })
        .then((response) => response.status)
        .catch(() => 0)),
  );
  const mediaReachable = mediaStatuses.filter(
    (status) => status >= 200 && status < 400,
  ).length;
  if (mediaReachable !== SNAPSHOT_SIZE) {
    throw new Error(`Only ${mediaReachable}/${SNAPSHOT_SIZE} packshots are reachable.`);
  }

  if (apply) {
    await upsert(baseUrl, "brands", brands, serviceHeaders);
    await upsert(baseUrl, "products", products, serviceHeaders);
    await upsert(baseUrl, "variants", variants, serviceHeaders);
  }

  const [liveProducts, liveVariants, publicVariants] = await Promise.all([
    requestJson(
      `${baseUrl}/rest/v1/products?select=id,approved,validated&id=in.(${productIds.join(",")})`,
      serviceHeaders,
    ),
    requestJson(
      `${baseUrl}/rest/v1/variants?select=id,product_id,sku,approved,validated,packshot_url,filter_brand,brand_name_denorm&id=in.(${variantIds.join(",")})`,
      serviceHeaders,
    ),
    requestJson(
      `${baseUrl}/rest/v1/variants?select=id&id=in.(${variantIds.join(",")})&validated=eq.true`,
      publicHeaders,
    ),
  ]);
  const after = {
    products: await countTable(baseUrl, "products", serviceHeaders),
    variants: await countTable(baseUrl, "variants", serviceHeaders),
  };
  const productSet = new Set(liveProducts.map((row) => String(row.id)));
  const verified = apply
    && liveProducts.length === SNAPSHOT_SIZE
    && liveVariants.length === SNAPSHOT_SIZE
    && publicVariants.length === SNAPSHOT_SIZE
    && liveProducts.every((row) => row.approved === true && row.validated === true)
    && liveVariants.every((row) =>
      row.approved === true
      && row.validated === true
      && productSet.has(String(row.product_id))
      && typeof row.packshot_url === "string"
      && typeof row.filter_brand === "string"
      && typeof row.brand_name_denorm === "string");

  console.log(JSON.stringify({
    mode: apply ? "apply" : "audit",
    source: {
      products: SNAPSHOT_SIZE,
      unresolvedExcluded: 2,
    },
    target: EXPECTED_PROJECT_REF,
    before,
    after,
    insertedOrVerified: {
      products: liveProducts.length,
      publicVariants: publicVariants.length,
      variants: liveVariants.length,
    },
    mediaReachable,
    manifestChecksum: checksum({ brands, products, variants }),
    conflicts: existingRows.size,
    verified,
    valuesPrinted: false,
  }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown catalog snapshot error.");
  process.exitCode = 1;
});
