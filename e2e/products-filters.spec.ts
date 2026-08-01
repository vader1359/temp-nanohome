import { expect, test, type Locator, type Page } from "@playwright/test";

const PRODUCTS_URL = "http://localhost:3000/vi/products";

function productCards(page: Page): Locator {
  return page.locator("[data-product-card]");
}

async function firstFilterValue(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector).first();
  await expect(element).toBeVisible();
  const value = await element.getAttribute("data-filter-value");
  expect(value).toBeTruthy();
  return value as string;
}

async function expectEveryCardAttribute(page: Page, attribute: string, expected: string): Promise<void> {
  await expect.poll(async () => {
    const cards = productCards(page);
    if (await cards.count() === 0) return false;
    return cards.evaluateAll(
      (elements, args) => elements.every((card) => card.getAttribute(args.attribute) === args.expected),
      { attribute, expected },
    );
  }, { timeout: 15_000 }).toBe(true);
}

async function expectEveryCardAttributeIncludes(page: Page, attribute: string, expected: string): Promise<void> {
  await expect.poll(async () => {
    const cards = productCards(page);
    if (await cards.count() === 0) return false;
    return cards.evaluateAll(
      (elements, args) => elements.every((card) => (card.getAttribute(args.attribute) ?? "").split("|").includes(args.expected)),
      { attribute, expected },
    );
  }, { timeout: 15_000 }).toBe(true);
}

async function firstProductName(page: Page): Promise<string> {
  const firstCard = productCards(page).first();
  await expect(firstCard).toBeVisible({ timeout: 15_000 });
  const name = (await firstCard.getAttribute("data-product-name"))?.trim();
  expect(name).toBeTruthy();
  return name as string;
}

async function expectVietnameseProductsPath(page: Page): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname).toBe("/vi/products");
}

test("brand filter updates URL and product grid", async ({ page }) => {
  const response = await page.goto(PRODUCTS_URL);
  expect(response?.status()).toBe(200);

  const brand = await firstFilterValue(page, "[data-filter-brand]");
  await page.locator(`[data-filter-brand][data-filter-value="${brand}"]`).first().click();

  await expect(page).toHaveURL(new RegExp(`brand=${encodeURIComponent(brand).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  await expectVietnameseProductsPath(page);
  await expectEveryCardAttribute(page, "data-product-brand", brand);
});

test("category and subcategory facets exist and constrain visible products", async ({ page }) => {
  const response = await page.goto(PRODUCTS_URL);
  expect(response?.status()).toBe(200);

  const category = await firstFilterValue(page, "[data-filter-category]");
  await page.locator(`[data-filter-category][data-filter-value="${category}"]`).first().click();
  await expect(page).toHaveURL(/category=/);
  await expectVietnameseProductsPath(page);
  await expectEveryCardAttribute(page, "data-product-category", category);

  await page.goto(PRODUCTS_URL);
  const subCategory = await firstFilterValue(page, "[data-filter-subcategory]");
  await page.locator(`[data-filter-subcategory][data-filter-value="${subCategory}"]`).first().click();
  await expect(page).toHaveURL(/subCategory=/);
  await expectVietnameseProductsPath(page);
  await expectEveryCardAttribute(page, "data-product-subcategory", subCategory);
});

test("room filter constrains visible products", async ({ page }) => {
  const response = await page.goto(PRODUCTS_URL);
  expect(response?.status()).toBe(200);

  const room = await firstFilterValue(page, "[data-filter-room]");
  await page.locator(`[data-filter-room][data-filter-value="${room}"]`).first().click();
  await expect(page).toHaveURL(/room=/);
  await expectVietnameseProductsPath(page);
  await expectEveryCardAttributeIncludes(page, "data-product-rooms", room);
});

test("status filter constrains visible products", async ({ page }) => {
  const response = await page.goto(PRODUCTS_URL);
  expect(response?.status()).toBe(200);

  await page.locator('[data-filter-status="in_stock"]').click();
  await expect(page).toHaveURL(/status=in_stock/);
  await expectVietnameseProductsPath(page);
  await expectEveryCardAttribute(page, "data-product-status", "in_stock");
});

test("search bar and applied filter chip update product results", async ({ page }) => {
  const response = await page.goto(PRODUCTS_URL);
  expect(response?.status()).toBe(200);
  const term = await firstProductName(page);

  await page.getByPlaceholder("Tìm kiếm sản phẩm").fill(term);
  await expect(page).toHaveURL(/q=/);
  await expectVietnameseProductsPath(page);
  await expect(productCards(page).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: term }).first().click();
  await expect(page).not.toHaveURL(/q=/);
  await expectVietnameseProductsPath(page);
});

test("header products and aggregate search links navigate to product results", async ({ page }) => {
  const response = await page.goto("http://localhost:3000/vi");
  expect(response?.status()).toBe(200);

  await page.getByRole("link", { name: /^Sản phẩm$/i }).first().click();
  await expect(page).toHaveURL(/\/vi\/products$/);
  await expect(productCards(page).first()).toBeVisible();
  const term = await firstProductName(page);

  await page.getByRole("link", { name: "Tìm kiếm" }).first().click();
  await expect(page).toHaveURL(/\/vi\/search$/);
  await page.getByRole("textbox", { name: "Tìm kiếm nanoHome" }).fill(term);
  await page.getByRole("textbox", { name: "Tìm kiếm nanoHome" }).press("Enter");

  await expect(page).toHaveURL(/\/vi\/search\?q=/);
  await expect(page.locator('[data-search-result="product"]').first()).toBeVisible({ timeout: 15_000 });
});
