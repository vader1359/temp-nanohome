import { expect, test } from "@playwright/test";

const productCard = "article[data-product-card]";
const productDetailLink = "a[data-product-image-frame]";

const waitForProductDetailLink = async (page: import("@playwright/test").Page, localePrefix: string) => {
  const card = page.locator(productCard).first();
  await expect(card).toBeVisible();
  const link = card.locator(productDetailLink).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", new RegExp(`^${localePrefix}/products/[^/?#]+$`));
  const href = (await link.getAttribute("href")) ?? "";
  expect(href.startsWith(`${localePrefix}/products/`)).toBe(true);
  return { link, href };
};

test("Vietnamese products page navigates to a product detail page", async ({ page }) => {
  const response = await page.goto("/vi/products");
  expect(response?.status()).toBe(200);

  const { link, href } = await waitForProductDetailLink(page, "/vi");
  await expect(page).toHaveURL("/vi/products");

  await Promise.all([page.waitForURL(href), link.click()]);

  await expect(page).toHaveURL(href);
  await expect(page).not.toHaveURL("/vi/products");
  await expect(page.locator("main")).toBeVisible();
});

test("English products page navigates to a product detail page", async ({ page }) => {
  const response = await page.goto("/en/products");
  expect(response?.status()).toBe(200);

  const { link, href } = await waitForProductDetailLink(page, "/en");
  await expect(page).toHaveURL("/en/products");

  await Promise.all([page.waitForURL(href), link.click()]);

  await expect(page).toHaveURL(href);
  await expect(page).not.toHaveURL("/en/products");
  await expect(page.locator("main")).toBeVisible();
});