#!/usr/bin/env node

import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname.replace(/\/$/u, "");
const pageSize = Number(process.argv.find((argument) => argument.startsWith("--page-size="))
  ?.slice("--page-size=".length) ?? "100");
if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1_000) {
  throw new Error("invalid_page_size");
}
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8")
    .split(/\r?\n/u)
    .flatMap((line) => {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
      return match === null ? [] : [[match[1], match[2].replace(/^['"]|['"]$/gu, "")]];
    }),
);
const baseUrl = new URL(env.AMIS_API_BASE_URL);
if (baseUrl.origin !== "https://crmconnect.misa.vn" || baseUrl.pathname !== "/") {
  throw new Error("amis_read_only_target_guard_failed");
}
if (!env.AMIS_CLIENT_ID || !env.AMIS_CLIENT_SECRET) {
  throw new Error("amis_read_only_credentials_missing");
}

const tokenResponse = await fetch(new URL("/api/v2/Account", baseUrl), {
  body: JSON.stringify({
    client_id: env.AMIS_CLIENT_ID,
    client_secret: env.AMIS_CLIENT_SECRET,
  }),
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  method: "POST",
  signal: AbortSignal.timeout(20_000),
});
const tokenBody = await tokenResponse.json();
if (!tokenResponse.ok || tokenBody?.success !== true || typeof tokenBody.data !== "string") {
  throw new Error(`amis_token_read_failed_${tokenResponse.status}`);
}

const productsUrl = new URL("/api/v2/Products", baseUrl);
productsUrl.searchParams.set("page", "0");
productsUrl.searchParams.set("pageSize", String(pageSize));
productsUrl.searchParams.set("orderBy", "modified_date");
productsUrl.searchParams.set("isDescending", "true");
const productsResponse = await fetch(productsUrl, {
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${tokenBody.data}`,
    Clientid: env.AMIS_CLIENT_ID,
  },
  signal: AbortSignal.timeout(20_000),
});
const productsBody = await productsResponse.json();
if (!productsResponse.ok || productsBody?.success !== true || !Array.isArray(productsBody.data)) {
  throw new Error(`amis_product_read_failed_${productsResponse.status}`);
}

const keys = [...new Set(productsBody.data.flatMap((row) => Object.keys(row)))].sort();
const nonEmptyCounts = Object.fromEntries(keys.map((key) => [
  key,
  productsBody.data.filter((row) => row[key] !== null && row[key] !== undefined && row[key] !== "").length,
]));
const valueTypes = Object.fromEntries(keys.map((key) => [
  key,
  [...new Set(productsBody.data.map((row) => Array.isArray(row[key]) ? "array" : typeof row[key]))].sort(),
]));

console.log(JSON.stringify({
  fields: keys,
  nonEmptyCounts,
  recordCount: productsBody.data.length,
  requestedPageSize: pageSize,
  sensitiveValuesPrinted: false,
  source: "AMIS /api/v2/Products read-only page 0",
  valueTypes,
}));
