import { expect, test } from "@playwright/test";

test("Vietnamese products page navigates to a product detail page", async ({ page }) => {
  const response = await page.goto("/vi/products");
  expect(response?.status()).toBe(200);

  await page.locator("a[href*='/products/']").first().click();

  await expect(page).toHaveURL(/\/vi\/products\//);
  await expect(page.locator("main")).toBeVisible();
});

test("English products page navigates to a product detail page", async ({ page }) => {
  const response = await page.goto("/en/products");
  expect(response?.status()).toBe(200);

  await page.locator("a[href*='/products/']").first().click();

  await expect(page).toHaveURL(/\/en\/products\//);
  await expect(page.locator("main")).toBeVisible();
});
