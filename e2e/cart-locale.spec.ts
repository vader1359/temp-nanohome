import { expect, test } from "@playwright/test";

test("English cart drawer is localized and keeps the checkout locale", async ({ page }) => {
  test.setTimeout(90_000);

  const response = await page.goto("/en/products");
  expect(response?.status()).toBe(200);

  const detailLink = page.locator("article[data-product-card] a[data-product-image-frame]").first();
  await expect(detailLink).toBeVisible({ timeout: 30_000 });
  const href = await detailLink.getAttribute("href");
  expect(href).toMatch(/^\/en\/products\/[^/?#]+$/);

  await Promise.all([
    page.waitForURL(href as string, { timeout: 60_000, waitUntil: "load" }),
    detailLink.click({ noWaitAfter: true }),
  ]);

  const addToCart = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(addToCart).toBeVisible({ timeout: 30_000 });
  await addToCart.click();

  const headerCart = page.getByRole("banner").getByRole("button", { name: "Cart", exact: true });
  await expect(headerCart).toContainText("1", { timeout: 15_000 });
  await headerCart.click();

  const dialog = page.getByRole("dialog", { name: "Cart", exact: true });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("button", { name: "Clear all", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Decrease quantity", exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Proceed to checkout", exact: true })).toHaveAttribute("href", "/en/checkout");
  await expect(dialog.getByText("Giỏ hàng", { exact: true })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(dialog.getByText("Your cart is empty", { exact: true }).last()).toBeVisible();
});
