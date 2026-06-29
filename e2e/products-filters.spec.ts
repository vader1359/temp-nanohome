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
  await expect(productCards(page).first()).toBeVisible({ timeout: 15_000 });
  const allMatch = await productCards(page).evaluateAll(
    (cards, args) => cards.every((card) => card.getAttribute(args.attribute) === args.expected),
    { attribute, expected },
  );
  expect(allMatch).toBe(true);
}

async function expectEveryCardAttributeIncludes(page: Page, attribute: string, expected: string): Promise<void> {
  await expect(productCards(page).first()).toBeVisible({ timeout: 15_000 });
  const allMatch = await productCards(page).evaluateAll(
    (cards, args) => cards.every((card) => (card.getAttribute(args.attribute) ?? "").split("|").includes(args.expected)),
    { attribute, expected },
  );
  expect(allMatch).toBe(true);
}

async function expectEveryCardAttributeContains(page: Page, attribute: string, expected: string): Promise<void> {
  await expect(productCards(page).first()).toBeVisible({ timeout: 15_000 });
  const allMatch = await productCards(page).evaluateAll(
    (cards, args) => cards.every((card) => (card.getAttribute(args.attribute) ?? "").toLowerCase().includes(args.expected.toLowerCase())),
    { attribute, expected },
  );
  expect(allMatch).toBe(true);
}

test("brand filter updates URL and product grid", async ({ page }) => {
  const response = await page.goto(PRODUCTS_URL);
  expect(response?.status()).toBe(200);

  const brand = await firstFilterValue(page, "[data-filter-brand]");
  await page.locator(`[data-filter-brand][data-filter-value="${brand}"]`).first().click();

  await expect(page).toHaveURL(new RegExp(`brand=${encodeURIComponent(brand).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  await expectEveryCardAttribute(page, "data-product-brand", brand);
});

test("category, subcategory, room, and status filters constrain visible products", async ({ page }) => {
  const response = await page.goto(PRODUCTS_URL);
  expect(response?.status()).toBe(200);

  const category = await firstFilterValue(page, "[data-filter-category]");
  await page.locator(`[data-filter-category][data-filter-value="${category}"]`).first().click();
  await expect(page).toHaveURL(/category=/);
  await expectEveryCardAttribute(page, "data-product-category", category);

  await page.goto(PRODUCTS_URL);
  const subCategory = await firstFilterValue(page, "[data-filter-subcategory]");
  await page.locator(`[data-filter-subcategory][data-filter-value="${subCategory}"]`).first().click();
  await expect(page).toHaveURL(/subCategory=/);
  await expectEveryCardAttribute(page, "data-product-subcategory", subCategory);

  await page.goto(PRODUCTS_URL);
  const room = await firstFilterValue(page, "[data-filter-room]");
  await page.locator(`[data-filter-room][data-filter-value="${room}"]`).first().click();
  await expect(page).toHaveURL(/room=/);
  await expectEveryCardAttributeIncludes(page, "data-product-rooms", room);

  await page.goto(PRODUCTS_URL);
  await page.locator('[data-filter-status="sale"]').click();
  await expect(page).toHaveURL(/status=sale/);
  await expectEveryCardAttribute(page, "data-product-status", "sale");
});

test("search bar and applied filter chip update product results", async ({ page }) => {
  const response = await page.goto(PRODUCTS_URL);
  expect(response?.status()).toBe(200);
  const term = "kaleido";

  await page.getByPlaceholder("Tìm kiếm sản phẩm").fill(term);
  await expect(page).toHaveURL(/q=/);
  await expect(productCards(page).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: term }).first().click();
  await expect(page).not.toHaveURL(/q=/);
});

test("header products link and header search navigate to filtered products", async ({ page }) => {
  const response = await page.goto("http://localhost:3000/vi");
  expect(response?.status()).toBe(200);

  await page.getByRole("link", { name: /^Sản phẩm$/i }).first().click();
  await expect(page).toHaveURL(/\/vi\/products$/);
  await expect(productCards(page).first()).toBeVisible();

  const term = "kaleido";

  await page.getByRole("button", { name: "Search" }).first().click();
  await page.getByLabel("Header product search").fill(term);
  await page.getByLabel("Header product search").press("Enter");

  await expect(page).toHaveURL(/\/vi\/products\?q=/);
  await expect(productCards(page).first()).toBeVisible({ timeout: 15_000 });
});
