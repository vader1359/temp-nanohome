import { expect, test } from "@playwright/test";

test("Vietnamese products page navigates to a product detail page", async ({ page }) => {
  const response = await page.goto("/vi/products");
  expect(response?.status()).toBe(200);

  await page.locator("a[href*='/san-pham/']").first().click();

  await expect(page).toHaveURL(/\/vi\/san-pham\//);
  await expect(page.locator("main")).toBeVisible();
});

test("English products page navigates to a product detail page", async ({ page }) => {
  const response = await page.goto("/en/products");
  expect(response?.status()).toBe(200);

  await page.locator("a[href*='/san-pham/']").first().click();

  await expect(page).toHaveURL(/\/en\/san-pham\//);
  await expect(page.locator("main")).toBeVisible();
});
