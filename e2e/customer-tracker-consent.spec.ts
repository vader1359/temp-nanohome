import { expect, test } from "@playwright/test";

const thirdPartyTracker = /(?:connect\.facebook\.net|facebook\.com\/tr|clarity\.ms|sp\.zalo\.me)/;

const customerContext = (analyticsTracking: boolean, marketingTracking: boolean) => JSON.stringify({
  locale: "vi",
  consent: {
    analytics: analyticsTracking,
    personalization: false,
    aiProcessing: false,
    aiConversationStorage: false,
    roomImageProcessing: false,
    roomImageStorage: false,
    version: "1",
  },
  capabilities: { analyticsTracking, marketingTracking },
});

test("optional trackers load only after marketing consent and stop after withdrawal", async ({ page }) => {
  let analyticsTracking = false;
  let marketingTracking = false;
  await page.route("**/api/customer/context", async (route) => {
    await route.fulfill({ contentType: "application/json", body: customerContext(analyticsTracking, marketingTracking) });
  });

  const requested: string[] = [];
  page.on("request", (networkRequest) => requested.push(networkRequest.url()));

  await page.goto("/vi");
  await expect(page).toHaveURL(/\/vi/);
  expect(requested.some((url) => thirdPartyTracker.test(url))).toBe(false);

  analyticsTracking = true;
  requested.length = 0;
  await page.evaluate(() => window.dispatchEvent(new Event("nanohome:customer-context-changed")));
  await expect(page.locator("[data-nanohome-trackers='active']")).toHaveCount(1);
  await expect(page.locator("[data-nanohome-tracker='zalo']")).toHaveCount(0);

  marketingTracking = true;
  await page.evaluate(() => window.dispatchEvent(new Event("nanohome:customer-context-changed")));
  await expect(page.locator("[data-nanohome-trackers='active']")).toHaveCount(1);

  analyticsTracking = false;
  marketingTracking = false;
  requested.length = 0;
  await page.evaluate(() => window.dispatchEvent(new Event("nanohome:customer-context-changed")));
  await expect(page.locator("[data-nanohome-trackers='active']")).toHaveCount(0);
  expect(requested.some((url) => thirdPartyTracker.test(url))).toBe(false);
});
