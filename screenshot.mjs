import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/vi/san-pham/lc2', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/product-detail-full.png', fullPage: true });
await page.screenshot({ path: '/tmp/product-detail-viewport.png', fullPage: false });
console.log('Screenshots saved');
await browser.close();