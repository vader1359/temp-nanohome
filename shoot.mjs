import { chromium } from "playwright";

const OUT = "/var/folders/mp/1wf5n7_d10x99gwdd6brzqbh0000gp/T/opencode/shots";
const URL = "http://localhost:3000/vi";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const browser = await chromium.launch();
for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  // Wait for fonts/images to settle
  await page.waitForTimeout(2500);

  // Scroll through the whole page to trigger lazy-loaded (IntersectionObserver)
  // Next/Image `fill` images so they actually render before the fullPage capture.
  await page.evaluate(async () => {
    const step = 400;
    const total = document.body.scrollHeight;
    for (let y = 0; y <= total; y += step) {
      window.scrollTo(0, y);
      // allow IntersectionObserver + image requests to kick off
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    // give in-flight image requests a moment to complete
  });
  await page.waitForTimeout(1500);

  // Full page screenshot (scrolls whole page)
  await page.screenshot({
    path: `${OUT}/home-${vp.name}-full.png`,
    fullPage: true,
  });

  // Above-the-fold only (viewport)
  await page.screenshot({
    path: `${OUT}/home-${vp.name}-fold.png`,
    fullPage: false,
  });

  // Also capture section-by-section by scrolling
  // Capture header area specifically on mobile/tablet
  if (vp.name !== "desktop") {
    const header = await page.locator("header").first();
    if (header) {
      await header.screenshot({ path: `${OUT}/home-${vp.name}-header.png` });
      // open mobile drawer if present (hamburger)
      const hamburger = page.locator('button[aria-label="Open menu"]');
      if ((await hamburger.count()) > 0) {
        await hamburger.click();
        await page.waitForTimeout(800);
        await header.screenshot({ path: `${OUT}/home-${vp.name}-drawer-open.png` });
      }
    }
  }

  await ctx.close();
}
await browser.close();
console.log("DONE");