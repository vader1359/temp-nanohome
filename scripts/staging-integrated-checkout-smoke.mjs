#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url).pathname.replace(/\/$/u, "");
const baseArgument = process.argv.find((argument) => argument.startsWith("--base="));
const baseUrl = new URL(baseArgument?.slice("--base=".length) ?? "http://localhost:3000");
const allowedTargets = new Set(["localhost", "127.0.0.1", "staging.nanohome.vn"]);
const fixturePath = "/vi/products/stg-amis-lwlfl00026-10k";
const fixtureName = "[STAGING TEST 10K]";
const fixtureAmount = 10_000;

assert(allowedTargets.has(baseUrl.hostname), "unsupported_browser_smoke_target");
assert(baseUrl.protocol === "http:" || baseUrl.protocol === "https:", "invalid_browser_smoke_protocol");
const base = baseUrl.origin;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseEnv(contents) {
  return Object.fromEntries(contents.split(/\r?\n/u).flatMap((line) => {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (match === null) return [];
    return [[match[1], match[2].replace(/^['"]|['"]$/gu, "")]];
  }));
}

function clearWindowsClipboard() {
  spawnSync("powershell.exe", ["-NoProfile", "-Command", "Set-Clipboard -Value $null"], {
    stdio: "ignore",
  });
}

function secureField(field) {
  const copied = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/staging-test-identities.ts", "copy", field],
    { cwd: root, stdio: "ignore" },
  );
  assert(copied.status === 0, "secure_identity_copy_failed");

  const read = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", "Get-Clipboard -Raw"],
    { encoding: "utf8" },
  );
  clearWindowsClipboard();
  assert(read.status === 0 && read.stdout.trim().length > 0, "secure_clipboard_read_failed");
  return read.stdout.trim();
}

async function exchangeSession(request, idToken) {
  const csrfResponse = await request.get(`${base}/api/auth/session`);
  assert(csrfResponse.status() === 200, "csrf_session_get_failed");
  const csrf = await csrfResponse.json();
  const response = await request.post(`${base}/api/auth/session`, {
    data: {
      csrfToken: csrf.csrfToken,
      idToken,
      intent: "checkout",
      locale: "vi",
      returnTo: "/vi/checkout",
    },
    headers: { Origin: base },
  });
  assert(response.status() === 200, "firebase_session_exchange_failed");
}

async function clearAccountCart(request) {
  let response = await request.get(`${base}/api/account/cart`);
  assert(response.status() === 200, "account_cart_read_failed");
  let body = await response.json();
  for (const item of body.cart.items) {
    response = await request.delete(`${base}/api/account/cart`, {
      data: { expectedVersion: body.cart.version, variantId: item.variantId },
      headers: { Origin: base },
    });
    assert(response.status() === 200, "account_cart_cleanup_failed");
    body = await response.json();
  }
  return body.cart.items.length === 0;
}

const env = parseEnv(readFileSync(`${root}/.env.local`, "utf8"));
assert(env.PAYMENT_MODE === "sepay_sandbox", "payment_mode_not_sandbox");
assert(env.SEPAY_ENV === "sandbox", "sepay_env_not_sandbox");

let email = secureField("email");
let password = secureField("password");
let phone = secureField("phone");
let idToken = "";

const firebaseResponse = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.NEXT_PUBLIC_FIREBASE_API_KEY)}`,
  {
    body: JSON.stringify({ email, password, returnSecureToken: true }),
    headers: { "content-type": "application/json" },
    method: "POST",
  },
);
assert(firebaseResponse.status === 200, "firebase_password_sign_in_failed");
const firebaseBody = await firebaseResponse.json();
idToken = firebaseBody.idToken;
email = "";
password = "";
assert(typeof idToken === "string" && idToken.length > 128, "firebase_id_token_missing");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
let result = {};

try {
  await page.goto(`${base}/vi`, { waitUntil: "domcontentloaded" });
  await exchangeSession(context.request, idToken);
  assert(await clearAccountCart(context.request), "initial_cart_not_empty");

  await context.clearCookies();
  await page.goto(`${base}${fixturePath}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Thêm vào giỏ" }).click();
  await page.getByRole("button", { name: "Giỏ hàng" }).click();
  const drawer = page.getByRole("dialog", { name: "Giỏ hàng" });
  const desktopCart = drawer.getByTestId("desktop-cart");
  await desktopCart.getByText(fixtureName, { exact: false }).waitFor();
  await desktopCart.getByRole("link", { name: "Hoàn tất giỏ hàng" }).click();
  await page.waitForURL(/\/vi\/account\/sign-in\?.*intent=checkout/u, { timeout: 30_000 });

  await exchangeSession(context.request, idToken);
  idToken = "";
  await page.goto(`${base}/vi/checkout`, { waitUntil: "domcontentloaded" });
  assert(new URL(page.url()).pathname === "/vi/checkout", "checkout_session_cookie_not_applied");

  const checkoutForm = page.getByTestId("checkout-form");
  try {
    await checkoutForm.waitFor({ state: "visible", timeout: 30_000 });
  } catch {
    const diagnosticResponse = await context.request.get(`${base}/api/account/cart`);
    const diagnosticCart = diagnosticResponse.status() === 200
      ? (await diagnosticResponse.json()).cart
      : null;
    const serverHasFixture = diagnosticCart?.items?.some((item) => item.title.includes(fixtureName))
      ?? false;
    throw new Error(serverHasFixture
      ? "checkout_not_refreshed_after_merge"
      : "guest_cart_not_merged");
  }
  await page.getByText(fixtureName, { exact: false }).first().waitFor({ timeout: 30_000 });
  const mergedResponse = await context.request.get(`${base}/api/account/cart`);
  assert(mergedResponse.status() === 200, "merged_cart_read_failed");
  const mergedCart = (await mergedResponse.json()).cart;
  assert(
    mergedCart.items.some((item) => item.title.includes(fixtureName) && item.quantity === 1),
    "guest_cart_not_merged",
  );

  await page.locator("#checkout-name").fill("Codex Staging Test");
  await page.locator("#checkout-address").fill("Staging test address - no delivery");
  const phoneInput = page.locator("#checkout-phone");
  if (await phoneInput.isEditable()) await phoneInput.fill(phone);
  phone = "";

  const checkoutResponsePromise = page.waitForResponse(
    (response) => response.url() === `${base}/api/checkout`,
    { timeout: 60_000 },
  );
  const paymentResponsePromise = page.waitForResponse(
    (response) => /\/api\/orders\/[^/]+\/payments\/sepay$/u.test(response.url()),
    { timeout: 60_000 },
  );
  await checkoutForm.locator('button[type="submit"]').click();
  const checkoutResponse = await checkoutResponsePromise;
  const paymentResponse = await paymentResponsePromise;
  assert([200, 201].includes(checkoutResponse.status()), "integrated_checkout_failed");
  assert([200, 201].includes(paymentResponse.status()), "integrated_payment_failed");

  const paymentBody = await paymentResponse.json();
  const payment = paymentBody.payment;
  assert(payment?.environment === "sandbox", "payment_not_sandbox");
  assert(payment?.amount === fixtureAmount, "payment_amount_mismatch");
  assert(payment?.currency === "VND", "payment_currency_mismatch");
  assert(payment?.state === "pending", "payment_state_not_pending");
  const paymentUrl = new URL(payment.paymentUrl);
  assert(
    paymentUrl.protocol === "https:" && paymentUrl.hostname === "vietqr.app",
    "payment_qr_host_invalid",
  );
  assert(Number(paymentUrl.searchParams.get("amount")) === fixtureAmount, "payment_qr_amount_mismatch");
  assert(
    paymentUrl.searchParams.get("des") === payment.merchantReference,
    "payment_qr_reference_mismatch",
  );

  await page.getByRole("heading", { name: /QR|SePay/iu }).waitFor({ timeout: 30_000 });
  const qrResponse = await context.request.get(payment.paymentUrl);
  assert(qrResponse.status() === 200, "payment_qr_fetch_failed");
  assert(
    (qrResponse.headers()["content-type"] ?? "").includes("image/"),
    "payment_qr_not_image",
  );

  const cleanupDone = await clearAccountCart(context.request);
  await page.evaluate(() => localStorage.clear());
  await context.clearCookies();

  result = {
    amount: payment.amount,
    autoMerge: true,
    checkoutStatus: checkoutResponse.status(),
    cleanupDone,
    guestRedirect: true,
    paymentEnvironment: payment.environment,
    paymentStatus: paymentResponse.status(),
    qrImage200: true,
    sensitiveValuesPrinted: false,
    sessionExchange: true,
  };
} finally {
  idToken = "";
  email = "";
  password = "";
  phone = "";
  clearWindowsClipboard();
  await context.close();
  await browser.close();
}

console.log(JSON.stringify(result));
