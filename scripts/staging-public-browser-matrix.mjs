#!/usr/bin/env node

import { chromium } from "@playwright/test";

const baseArgument = process.argv.find((argument) => argument.startsWith("--base="));
const baseUrl = new URL(baseArgument?.slice("--base=".length) ?? "https://staging.nanohome.vn");
const allowedHosts = new Set(["staging.nanohome.vn", "localhost", "127.0.0.1"]);
const fixturePath = "/vi/products/stg-amis-lwlfl00026-10k";

if (!allowedHosts.has(baseUrl.hostname)) throw new Error("unsupported_browser_matrix_target");
if (baseUrl.protocol !== "https:" && baseUrl.hostname === "staging.nanohome.vn") {
  throw new Error("staging_browser_matrix_requires_https");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function pageFacts(page) {
  return page.evaluate(() => ({
    brokenImages: Array.from(document.images).filter((image) => image.complete && image.naturalWidth === 0).length,
    hasH1: Boolean(document.querySelector("h1")),
    lang: document.documentElement.lang,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
}

async function publicSmoke(page, locale, viewportName) {
  await page.goto(`${baseUrl.origin}/${locale}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 30_000 });
  const home = await pageFacts(page);
  assert(home.lang === locale, `home_locale_${locale}_${viewportName}`);
  assert(home.hasH1 && home.brokenImages === 0 && !home.overflow, `home_layout_${locale}_${viewportName}`);

  await page.goto(`${baseUrl.origin}/${locale}/search?q=sofa`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  const search = await pageFacts(page);
  const resultCount = await page.locator("article").count();
  assert(search.lang === locale && resultCount > 0, `search_results_${locale}_${viewportName}`);
  assert(search.brokenImages === 0 && !search.overflow, `search_layout_${locale}_${viewportName}`);
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [viewportName, viewport] of [
    ["desktop", { height: 900, width: 1_440 }],
    ["mobile", { height: 844, width: 390 }],
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const locales = viewportName === "mobile" ? ["vi"] : ["vi", "en", "ko"];
    for (const locale of locales) {
      await publicSmoke(page, locale, viewportName);
      results.push({ locale, viewport: viewportName, status: "PASS" });
    }

    await page.goto(`${baseUrl.origin}${fixturePath}`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor({ timeout: 30_000 });
    const fixture = await pageFacts(page);
    assert(fixture.lang === "vi" && fixture.brokenImages === 0 && !fixture.overflow, `fixture_layout_${viewportName}`);
    await page.getByRole("button", { name: /Thêm vào giỏ|Add to cart|장바구니에 추가/iu }).click();
    await page.getByRole("button", { name: /Giỏ hàng|Cart|장바구니/iu }).click();
    await page.getByRole("dialog").waitFor({ timeout: 30_000 });
    const cart = await pageFacts(page);
    assert(cart.brokenImages === 0 && !cart.overflow, `cart_layout_${viewportName}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  base: baseUrl.origin,
  results,
  sensitiveValuesPrinted: false,
}));
