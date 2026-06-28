import { test, expect } from "@playwright/test";

test("root path '/' redirects to default locale /vi with html lang=vi", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/vi/);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test("/vi returns 200 with html lang=vi", async ({ page }) => {
  const response = await page.goto("/vi");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
});

test("/en returns 200 with html lang=en", async ({ page }) => {
  const response = await page.goto("/en");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("/de (invalid locale) redirects or returns 404", async ({ page }) => {
  const response = await page.goto("/de");
  // The middleware redirects /de to /vi/de or returns 404. Since next-intl
  // with localePrefix: 'always' redirects root path to default locale,
  // let's check both possibilities (status 404 or redirect location/url)
  const status = response?.status();
  expect(status === 404 || page.url().includes("/vi")).toBe(true);
});

test("invalid locale does not resolve as a supported locale route", async ({ request }) => {
  const response = await request.get("/de", { maxRedirects: 0 });

  expect([307, 308, 404]).toContain(response.status());
  if (response.status() === 307 || response.status() === 308) {
    expect(response.headers().location).toMatch(/^\/vi(?:\/de)?/);
  }
});

test("/vi/products returns 200", async ({ page }) => {
  const response = await page.goto("/vi/products");
  expect(response?.status()).toBe(200);
});

test("/en/products returns 200", async ({ page }) => {
  const response = await page.goto("/en/products");
  expect(response?.status()).toBe(200);
});

test("auth session-like cookie survives the i18n plus Supabase refresh path", async ({
  context,
  page,
}) => {
  const cookie = {
    name: "sb-e2e-auth-token",
    value: "e2e-session-cookie-preserved",
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: false,
  };

  await context.addCookies([cookie]);
  const response = await page.goto("/vi");
  expect(response?.status()).toBe(200);

  const cookies = await context.cookies("http://localhost:3000/vi");
  expect(cookies).toEqual(expect.arrayContaining([expect.objectContaining(cookie)]));
});

test("/_next/static asset path bypasses i18n middleware (no redirect to /vi)", async ({
  page,
}) => {
  const response = await page.goto("/_next/static/never-exists.css");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(/\/_next\/static\/never-exists\.css/);
});

test("auth and api matcher exclusions do not get locale-prefixed", async ({ request }) => {
  const authResponse = await request.get("/auth/callback", { maxRedirects: 0 });
  expect(authResponse.headers().location ?? "").not.toMatch(/^\/vi\/auth/);

  const apiResponse = await request.post("/api/cron/amis-sync", { maxRedirects: 0 });
  expect(apiResponse.headers().location ?? "").not.toMatch(/^\/vi\/api/);
});
