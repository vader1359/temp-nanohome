import { test, expect } from "@playwright/test";

test("should redirect to default locale /vi", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/vi/);
  const title = page.locator("h1");
  await expect(title).toContainText("Chào mừng đến với NanoHome");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", "vi");
});

test("should support /en locale path", async ({ page }) => {
  await page.goto("/en");
  const title = page.locator("h1");
  await expect(title).toContainText("Welcome to NanoHome");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", "en");
});

test("should return 404 for invalid locale /de", async ({ page }) => {
  const response = await page.goto("/de");
  expect(response?.status()).toBe(404);
});
