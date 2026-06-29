const { chromium } = require("playwright");

const BASE = "http://localhost:3001";
const viewports = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];
const pages = [
  { name: "homepage", path: "/vi" },
  { name: "products", path: "/vi/products" },
  { name: "product-detail", path: "/vi/products/den-tha-aim-small-bang-aluminum-pc-luc-ivy" },
];

(async () => {
  const browser = await chromium.launch();
  const issues = [];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push("PAGE ERROR: " + err.message);
    });

    for (const p of pages) {
      const url = BASE + p.path;
      console.log("\n=== " + vp.name + " | " + p.name + " (" + url + ") ===");

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      } catch (e) {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(2000);
        } catch (e2) {
          console.log("  LOAD FAILED: " + e2.message);
          issues.push(vp.name + "/" + p.name + ": LOAD FAILED - " + e2.message);
          continue;
        }
      }

      await page.waitForTimeout(1500);

      // Horizontal overflow check
      const dims = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (dims.scrollWidth > dims.clientWidth + 5) {
        console.log("  HORIZONTAL OVERFLOW: scroll=" + dims.scrollWidth + " client=" + dims.clientWidth);
        issues.push(vp.name + "/" + p.name + ": HORIZONTAL OVERFLOW (scroll=" + dims.scrollWidth + " client=" + dims.clientWidth + ")");
      } else {
        console.log("  No horizontal overflow (scroll=" + dims.scrollWidth + " client=" + dims.clientWidth + ")");
      }

      // Broken images
      const brokenImages = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("img"));
        return imgs
          .filter((img) => img.naturalWidth === 0 && img.complete)
          .map((img) => img.src || img.getAttribute("src") || "(no src)");
      });
      if (brokenImages.length > 0) {
        console.log("  BROKEN IMAGES: " + brokenImages.length);
        brokenImages.slice(0, 5).forEach((src) => console.log("    - " + src));
        issues.push(vp.name + "/" + p.name + ": " + brokenImages.length + " BROKEN IMAGES");
      } else {
        console.log("  No broken images detected");
      }

      // Console errors
      if (consoleErrors.length > 0) {
        console.log("  CONSOLE ERRORS (" + consoleErrors.length + "):");
        consoleErrors.slice(0, 5).forEach((e) => console.log("    - " + e.substring(0, 200)));
        issues.push(vp.name + "/" + p.name + ": " + consoleErrors.length + " console errors");
      } else {
        console.log("  No console errors");
      }

      // Screenshot
      const screenshotPath = "test-screenshots/" + vp.name + "-" + p.name + ".png";
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log("  Screenshot: " + screenshotPath);

      if (vp.name === "mobile-375") {
        const fullPagePath = "test-screenshots/" + vp.name + "-" + p.name + "-full.png";
        await page.screenshot({ path: fullPagePath, fullPage: true });
        const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        console.log("  Full page height: " + pageHeight + "px");
      }
    }

    await context.close();
  }

  await browser.close();

  console.log("\n\n======== SUMMARY ========");
  if (issues.length === 0) {
    console.log("No issues found!");
  } else {
    console.log(issues.length + " issues found:");
    issues.forEach((i) => console.log("  - " + i));
  }
  process.exit(issues.length > 0 ? 1 : 0);
})();