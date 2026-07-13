import percySnapshot from "@percy/playwright";
import { expect, test } from "@playwright/test";

async function stabilizePage(page: Parameters<typeof percySnapshot>[0]) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
}

test.describe("visual regression", () => {
  test("Vietnamese homepage", async ({ page }) => {
    await page.goto("/vi", { waitUntil: "networkidle" });
    await expect(page.locator("main")).toBeVisible();
    await stabilizePage(page);

    await percySnapshot(page, "Homepage - Vietnamese");
  });

  test("Vietnamese products catalog", async ({ page }) => {
    await page.goto("/vi/products", { waitUntil: "networkidle" });
    await expect(page.locator("[data-product-card]").first()).toBeVisible({
      timeout: 15_000,
    });
    await stabilizePage(page);

    await percySnapshot(page, "Products - Vietnamese");
  });
});
