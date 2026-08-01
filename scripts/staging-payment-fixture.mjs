#!/usr/bin/env node

import { readFileSync } from "node:fs";

const fixture = Object.freeze({
  namePrefix: "[STAGING TEST 10K]",
  price: 10_000,
  sku: "STG-AMIS-LWLFL00026-10K",
  stock: 100,
});
const allowedActions = new Set(["ensure", "remove", "status"]);
const action = process.argv[2] ?? "status";
const confirmedStaging = process.argv.includes("--confirm-staging");

if (!allowedActions.has(action)) {
  throw new Error("usage: staging-payment-fixture.mjs <status|ensure|remove> [--confirm-staging]");
}
if (action !== "status" && !confirmedStaging) {
  throw new Error("staging_confirmation_required");
}

const root = new URL("../", import.meta.url).pathname.replace(/\/$/u, "");
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8")
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
      return match === null ? [] : [[match[1], match[2].replace(/^['"]|['"]$/gu, "")]];
    }),
);

if (env.PAYMENT_MODE !== "sepay_sandbox" || env.SEPAY_ENV !== "sandbox") {
  throw new Error("sandbox_payment_configuration_required");
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("staging_supabase_configuration_missing");
}

const serviceHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
};

async function requestRows(path, searchParams = {}, init = {}) {
  const endpoint = new URL(`/rest/v1/${path}`, env.NEXT_PUBLIC_SUPABASE_URL);
  for (const [key, value] of Object.entries(searchParams)) endpoint.searchParams.set(key, value);
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      ...serviceHeaders,
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`staging_fixture_request_failed_${path}_${response.status}`);
  const body = await response.text();
  return body === "" ? [] : JSON.parse(body);
}

const variants = await requestRows("variants", {
  sku: `eq.${fixture.sku}`,
  select: "sku,name,price,stock,approved,validated,packshot_url,raw",
});
const variant = variants[0];
const fixtureIsSafe = variants.length === 1
  && variant?.sku === fixture.sku
  && typeof variant.name === "string"
  && variant.name.startsWith(fixture.namePrefix)
  && Number(variant.price) === fixture.price
  && Number(variant.stock) === fixture.stock
  && variant.approved === true
  && variant.validated === true
  && typeof variant.packshot_url === "string"
  && /^https?:\/\//u.test(variant.packshot_url)
  && variant.raw !== null
  && typeof variant.raw === "object"
  && !Array.isArray(variant.raw)
  && variant.raw.sku === fixture.sku
  && Number(variant.raw.fixture_stock) === fixture.stock;

if (!fixtureIsSafe) throw new Error("staging_fixture_guard_failed");

const states = await requestRows("amis_inventory_sync_state", {
  limit: "1",
  select: "active_baseline_id",
  sync_key: "eq.inventory",
});
const baselineId = states[0]?.active_baseline_id;
if (typeof baselineId !== "string") throw new Error("active_inventory_baseline_missing");

const baselines = await requestRows("amis_inventory_baselines", {
  id: `eq.${baselineId}`,
  select: "completed_at,is_active",
});
const completedAt = baselines[0]?.completed_at;
const baselineAgeSeconds = typeof completedAt === "string"
  ? Math.max(0, Math.round((Date.now() - Date.parse(completedAt)) / 1_000))
  : Number.POSITIVE_INFINITY;
if (baselines[0]?.is_active !== true || baselineAgeSeconds >= 86_400) {
  throw new Error("active_inventory_baseline_stale");
}

const readFixtureLines = () => requestRows("amis_inventory_baseline_lines", {
  baseline_id: `eq.${baselineId}`,
  select: "sku,stock",
  sku: `eq.${fixture.sku}`,
});

const before = await readFixtureLines();
let changed = false;

if (action === "ensure" && Number(before[0]?.stock) !== fixture.stock) {
  await requestRows("amis_inventory_baseline_lines", {
    on_conflict: "baseline_id,sku",
  }, {
    body: JSON.stringify([{
      baseline_id: baselineId,
      sku: fixture.sku,
      stock: fixture.stock,
    }]),
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    method: "POST",
  });
  changed = true;
}

if (action === "remove" && before.length > 0) {
  await requestRows("amis_inventory_baseline_lines", {
    baseline_id: `eq.${baselineId}`,
    sku: `eq.${fixture.sku}`,
  }, {
    headers: { Prefer: "return=representation" },
    method: "DELETE",
  });
  changed = true;
}

const [after, eligibilityRows] = await Promise.all([
  readFixtureLines(),
  requestRows("catalog_eligibility", {
    select: "sku,stock,has_fresh_stock,reason_codes,storefront,cart,payment",
    sku: `eq.${fixture.sku}`,
  }),
]);
const eligibility = eligibilityRows[0];
if (action === "ensure" && (
  Number(after[0]?.stock) !== fixture.stock
  || eligibility?.storefront !== true
  || eligibility?.cart !== true
  || eligibility?.payment !== true
)) {
  throw new Error("staging_fixture_not_eligible_after_ensure");
}

console.log(JSON.stringify({
  action,
  baselineAgeSeconds,
  changed,
  fixtureLinePresent: after.length === 1,
  fixtureSku: fixture.sku,
  fixtureStock: after[0]?.stock ?? null,
  eligibility: eligibility === undefined ? null : {
    cart: eligibility.cart,
    hasFreshStock: eligibility.has_fresh_stock,
    payment: eligibility.payment,
    reasonCodes: eligibility.reason_codes,
    storefront: eligibility.storefront,
  },
  environment: "staging-preview/sepay-sandbox",
  sensitiveValuesPrinted: false,
}));
