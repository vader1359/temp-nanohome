#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const base = new URL("https://staging.nanohome.vn");
const recoveryCookieName = "__Host-nanohome-email-recovery";
const projectId = "temp-nanohome";
let currentStep = "bootstrap";

process.on("unhandledRejection", () => {
  console.error(JSON.stringify({ error: "staging_email_link_smoke_failed", step: currentStep }));
  process.exitCode = 1;
});
process.on("uncaughtException", () => {
  console.error(JSON.stringify({ error: "staging_email_link_smoke_failed", step: currentStep }));
  process.exitCode = 1;
});

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

function randomEmail(label) {
  return `codex-${label}-${randomBytes(8).toString("hex")}@nanohome.vn`;
}

async function signInWithPassword(apiKey, email, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  assert(response.status === 200, "firebase_test_sign_in_failed");
  const body = await response.json();
  assert(typeof body.idToken === "string" && body.idToken.length > 128, "firebase_test_token_missing");
  return body.idToken;
}

async function browserRequest(page, path, method, data) {
  return page.evaluate(async ({ data: requestData, method: requestMethod, path: requestPath }) => {
    const response = await fetch(requestPath, {
      body: requestData === undefined ? undefined : JSON.stringify(requestData),
      credentials: "same-origin",
      headers: requestData === undefined ? {} : { "Content-Type": "application/json" },
      method: requestMethod,
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      // Keep the harness result status-only for non-JSON failures.
    }
    return { body, status: response.status };
  }, { data, method, path });
}

async function recoveryStart(page, input) {
  const response = await browserRequest(page, "/api/auth/email-link/recovery", "POST", input);
  assert(response.status === 201, "recovery_start_failed");
  const body = response.body;
  assert(typeof body.state === "string" && /^[A-Za-z0-9_-]{43}$/u.test(body.state), "recovery_state_not_opaque");
  const cookie = (await page.context().cookies(base.origin)).find((candidate) => candidate.name === recoveryCookieName);
  assert(cookie !== undefined, "recovery_cookie_missing");
  return { cookie, state: body.state };
}

async function setRecoveryCookie(context, cookie) {
  await context.clearCookies({ name: recoveryCookieName });
  await context.addCookies([{
    httpOnly: true,
    name: recoveryCookieName,
    sameSite: "Lax",
    secure: true,
    url: `${base.origin}/`,
    value: cookie.value,
  }]);
}

async function firebaseStorageFacts(page) {
  return page.evaluate(async () => ({
    databases: typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map((database) => database.name).filter((name) => typeof name === "string" && name.includes("firebase"))
      : [],
    firebaseLocalStorageKeys: Object.keys(localStorage).filter((key) => key.includes("firebase")).length,
  }));
}

async function readFirebaseAuthRecords(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("firebaseLocalStorageDb");
    request.onerror = () => reject(new Error("firebase_storage_read_failed"));
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("firebaseLocalStorage")) {
        database.close();
        resolve([]);
        return;
      }
      const transaction = database.transaction("firebaseLocalStorage", "readonly");
      const records = transaction.objectStore("firebaseLocalStorage").getAll();
      records.onerror = () => reject(new Error("firebase_storage_records_failed"));
      records.onsuccess = () => {
        database.close();
        resolve(records.result);
      };
    };
  }));
}

async function writeFirebaseAuthRecords(page, records) {
  await page.evaluate((storedRecords) => new Promise((resolve, reject) => {
    const request = indexedDB.open("firebaseLocalStorageDb");
    request.onerror = () => reject(new Error("firebase_storage_open_failed"));
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("firebaseLocalStorage")) {
        database.close();
        reject(new Error("firebase_storage_store_missing"));
        return;
      }
      const transaction = database.transaction("firebaseLocalStorage", "readwrite");
      const store = transaction.objectStore("firebaseLocalStorage");
      for (const record of storedRecords) store.put(record);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(new Error("firebase_storage_write_failed"));
    };
  }), records);
}

async function readFirebaseAuthLocalStorage(page) {
  return page.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.includes("firebase")));
}

async function writeFirebaseAuthLocalStorage(page, entries) {
  await page.evaluate((storedEntries) => {
    for (const [key, value] of storedEntries) localStorage.setItem(key, value);
  }, entries);
}

async function deleteUser(auth, uid) {
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
}

const env = parseEnv(readFileSync(".env.local", "utf8"));
assert(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === projectId, "wrong_firebase_project");
assert(env.NEXT_PUBLIC_APP_ORIGIN === base.origin, "wrong_staging_origin");
process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS;

const app = initializeApp({ credential: applicationDefault(), projectId });
const adminAuth = getAuth(app);
const identities = [];
const currentEmail = randomEmail("recovery");
const currentPassword = randomBytes(24).toString("base64url");
const nextEmail = randomEmail("verified");
const otherEmail = randomEmail("other");
const otherPassword = randomBytes(24).toString("base64url");
const unverifiedEmail = randomEmail("unverified");
const unverifiedPassword = randomBytes(24).toString("base64url");

const currentUser = await adminAuth.createUser({
  email: currentEmail,
  emailVerified: true,
  password: currentPassword,
});
const otherUser = await adminAuth.createUser({
  email: otherEmail,
  emailVerified: true,
  password: otherPassword,
});
const unverifiedUser = await adminAuth.createUser({
  email: unverifiedEmail,
  emailVerified: false,
  password: unverifiedPassword,
});
identities.push(currentUser.uid, otherUser.uid, unverifiedUser.uid);

const currentToken = await signInWithPassword(env.NEXT_PUBLIC_FIREBASE_API_KEY, currentEmail, currentPassword);
const otherToken = await signInWithPassword(env.NEXT_PUBLIC_FIREBASE_API_KEY, otherEmail, otherPassword);
const unverifiedToken = await signInWithPassword(env.NEXT_PUBLIC_FIREBASE_API_KEY, unverifiedEmail, unverifiedPassword);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { height: 900, width: 1_440 } });
const page = await context.newPage();
let releaseSessionRequest;
let sessionRequestSeenResolve;
const sessionRequestSeen = new Promise((resolve) => { sessionRequestSeenResolve = resolve; });
let sessionRequestHeld = false;
await page.route("**/api/auth/session", async (route) => {
  if (!sessionRequestHeld && route.request().method() === "GET") {
    sessionRequestHeld = true;
    sessionRequestSeenResolve();
    await new Promise((resolve) => { releaseSessionRequest = resolve; });
    await route.abort("aborted");
    return;
  }
  await route.continue();
});

const network = [];
const consoleSummary = { error: 0, warning: 0, messages: [] };
const callbackPage = await context.newPage();
callbackPage.on("response", (response) => {
  const url = new URL(response.url());
  if (url.origin === base.origin && (url.pathname.includes("email-link/recovery") || url.pathname === "/api/auth/session")) {
    network.push({ host: url.hostname, method: response.request().method(), path: url.pathname, status: response.status() });
  } else if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("firebaseapp.com")) {
    network.push({ host: url.hostname, method: response.request().method(), path: url.pathname, status: response.status() });
  }
});
callbackPage.on("console", (message) => {
  if (message.type() === "error") {
    consoleSummary.error += 1;
    if (consoleSummary.messages.length < 5) {
      consoleSummary.messages.push(message.text()
        .replace(/https?:\/\/[^\s]+/gu, "[url]")
        .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, "[email]")
        .replace(/[A-Za-z0-9_-]{30,}/gu, "[opaque]")
        .slice(0, 160));
    }
  }
  if (message.type() === "warning") consoleSummary.warning += 1;
});

let result;
try {
  currentStep = "sign_in_hold";
  await page.goto(`${base.origin}/en/account/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Email", exact: true }).click();
  await page.locator("#account-email").fill(currentEmail);
  await page.locator("#account-password").fill(currentPassword);
  await page.getByRole("button", { name: "Sign in with email", exact: true }).click();
  await sessionRequestSeen;
  await page.waitForTimeout(2_500);
  const originalTabFirebaseStorage = await firebaseStorageFacts(page);
  currentStep = "read_firebase_auth_records";
  const firebaseAuthRecords = await readFirebaseAuthRecords(page);
  const firebaseAuthLocalStorage = await readFirebaseAuthLocalStorage(page);
  assert(firebaseAuthRecords.length > 0 || firebaseAuthLocalStorage.length > 0, "original_tab_firebase_user_missing");
  currentStep = "write_firebase_auth_records";
  await callbackPage.goto(`${base.origin}/en`, { waitUntil: "domcontentloaded" });
  if (firebaseAuthRecords.length > 0) await writeFirebaseAuthRecords(callbackPage, firebaseAuthRecords);
  if (firebaseAuthLocalStorage.length > 0) await writeFirebaseAuthLocalStorage(callbackPage, firebaseAuthLocalStorage);
  await callbackPage.reload({ waitUntil: "domcontentloaded" });
  const callbackPreActionStorage = await firebaseStorageFacts(callbackPage);

  currentStep = "recovery_start";
  const negativeStart = await recoveryStart(page, {
    email: nextEmail,
    idToken: currentToken,
    intent: "checkout",
    locale: "en",
    returnTo: "/en/checkout?step=contact&auth=login",
  });
  const negativeCookie = negativeStart.cookie;

  currentStep = "negative_recovery_matrix";
  const crossOriginResponse = await context.request.post(`${base.origin}/api/auth/email-link/recovery`, {
    data: {
      email: nextEmail,
      idToken: currentToken,
      intent: "checkout",
      locale: "en",
      returnTo: "/en/checkout",
    },
    headers: { Origin: "https://evil.example" },
  });
  currentStep = `cross_origin_${crossOriginResponse.status()}`;
  assert(crossOriginResponse.status() === 403, "cross_origin_recovery_post_accepted");

  const [cookiePayload, cookieSignature] = negativeCookie.value.split(".");
  const tamperedSignature = `${cookieSignature[0] === "A" ? "B" : "A"}${cookieSignature.slice(1)}`;
  const tamperedValue = `${cookiePayload}.${tamperedSignature}`;
  currentStep = "tampered_cookie_request";
  await setRecoveryCookie(context, { ...negativeCookie, value: tamperedValue });
  const tamperedResponse = await browserRequest(page, `/api/auth/email-link/recovery?state=${negativeStart.state}`, "GET");
  currentStep = `tampered_cookie_${tamperedResponse.status}`;
  assert(tamperedResponse.status === 400, "tampered_recovery_cookie_accepted");
  await setRecoveryCookie(context, negativeCookie);

  currentStep = "uid_mismatch_request";
  const uidMismatchResponse = await browserRequest(page, "/api/auth/email-link/recovery", "PUT", {
    idToken: otherToken,
    state: negativeStart.state,
  });
  currentStep = `uid_mismatch_${uidMismatchResponse.status}`;
  assert(uidMismatchResponse.status === 409, "uid_mismatch_accepted");
  currentStep = "email_mismatch_request";
  const emailMismatchResponse = await browserRequest(page, "/api/auth/email-link/recovery", "PUT", {
    idToken: currentToken,
    state: negativeStart.state,
  });
  currentStep = `email_mismatch_${emailMismatchResponse.status}`;
  assert(emailMismatchResponse.status === 409, "email_mismatch_accepted");

  currentStep = "firebase_action_link";
  const happyStart = await recoveryStart(page, {
    email: currentEmail,
    idToken: currentToken,
    intent: "checkout",
    locale: "en",
    returnTo: "/en/checkout?step=contact&auth=login",
  });
  const happyCookie = happyStart.cookie;
  currentStep = "firebase_action_link";
  const actionLink = await adminAuth.generateEmailVerificationLink(currentEmail, {
    handleCodeInApp: false,
    url: `${base.origin}/en/auth/email-link?state=${encodeURIComponent(happyStart.state)}`,
  });
  const actionUrl = new URL(actionLink);
  const mode = actionUrl.searchParams.get("mode");
  const actionCode = actionUrl.searchParams.get("oobCode");
  assert((mode === "verifyEmail" || mode === "verifyAndChangeEmail") && actionCode, "firebase_action_link_invalid");
  const callbackUrl = `${base.origin}/en/auth/email-link?state=${encodeURIComponent(happyStart.state)}&mode=${encodeURIComponent(mode)}&oobCode=${encodeURIComponent(actionCode)}`;

  consoleSummary.error = 0;
  consoleSummary.warning = 0;
  consoleSummary.messages = [];
  currentStep = "callback_happy_path";
  await callbackPage.goto(callbackUrl, { waitUntil: "domcontentloaded" });
  let callbackReachedCheckout = false;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const observedUrl = new URL(callbackPage.url());
    if (observedUrl.origin === base.origin
      && observedUrl.pathname === "/en/checkout"
      && observedUrl.search === "?step=contact") {
      callbackReachedCheckout = true;
      break;
    }
    await callbackPage.waitForTimeout(500);
  }
  if (!callbackReachedCheckout) {
    const observedUrl = new URL(callbackPage.url());
    const heading = (await callbackPage.locator("h1").first().innerText().catch(() => "none"))
      .replace(/\s+/gu, " ")
      .slice(0, 80);
    const statusText = (await callbackPage.getByRole("status").first().innerText().catch(() => "none"))
      .replace(/\s+/gu, " ")
      .slice(0, 120);
    const callbackTabFirebaseStorage = await firebaseStorageFacts(callbackPage);
    currentStep = `callback_not_checkout:${observedUrl.pathname}:${heading}:${statusText}:${JSON.stringify({ originalTabFirebaseStorage, callbackPreActionStorage, callbackTabFirebaseStorage, network })}`;
    throw new Error(`callback_not_checkout:${observedUrl.pathname}:${heading}`);
  }
  const callbackFinalUrl = new URL(callbackPage.url());
  assert(callbackFinalUrl.origin === base.origin, "recovery_final_origin_invalid");
  assert(callbackFinalUrl.pathname === "/en/checkout" && callbackFinalUrl.search === "?step=contact", "recovery_return_path_not_sanitized");

  currentStep = "recovered_session_assertions";
  const customerContextResponse = await browserRequest(callbackPage, "/api/customer/context", "GET");
  assert(customerContextResponse.status === 200, "recovered_session_context_failed");
  const sessionCookies = (await context.cookies(base.origin)).filter((cookie) => cookie.name.includes("session"));
  assert(sessionCookies.some((cookie) => cookie.httpOnly && cookie.secure && cookie.sameSite === "Lax"), "session_cookie_flags_invalid");
  await callbackPage.reload({ waitUntil: "domcontentloaded" });
  assert(new URL(callbackPage.url()).pathname === "/en/checkout", "recovered_checkout_refresh_failed");

  await setRecoveryCookie(context, happyCookie);
  const replayResponse = await browserRequest(callbackPage, `/api/auth/email-link/recovery?state=${happyStart.state}`, "GET");
  assert(replayResponse.status === 409, "replayed_recovery_not_rejected");

  currentStep = "replay_and_concurrency";
  await context.clearCookies();
  const currentUpdatedToken = await signInWithPassword(env.NEXT_PUBLIC_FIREBASE_API_KEY, currentEmail, currentPassword);
  const concurrentStart = await recoveryStart(callbackPage, {
    email: currentEmail,
    idToken: currentUpdatedToken,
    intent: "account",
    locale: "en",
    returnTo: "/en/account",
  });
  const concurrentResponses = await Promise.all([
    browserRequest(callbackPage, "/api/auth/email-link/recovery", "PUT", {
      idToken: currentUpdatedToken,
      state: concurrentStart.state,
    }),
    browserRequest(callbackPage, "/api/auth/email-link/recovery", "PUT", {
      idToken: currentUpdatedToken,
      state: concurrentStart.state,
    }),
  ]);
  const concurrentStatuses = concurrentResponses.map((response) => response.status).sort((left, right) => left - right);
  assert(concurrentStatuses[0] === 200 && concurrentStatuses[1] === 409, "concurrent_recovery_replay_not_atomic");

  currentStep = "unverified_and_safe_redirect";
  await context.clearCookies();
  const unverifiedStart = await recoveryStart(callbackPage, {
    email: unverifiedEmail,
    idToken: unverifiedToken,
    intent: "account",
    locale: "en",
    returnTo: "/en/account",
  });
  const unverifiedConsume = await browserRequest(callbackPage, "/api/auth/email-link/recovery", "PUT", {
    idToken: unverifiedToken,
    state: unverifiedStart.state,
  });
  assert(unverifiedConsume.status === 409, "unverified_email_recovery_accepted");

  await context.clearCookies();
  const safeReturnStart = await recoveryStart(callbackPage, {
    email: currentEmail,
    idToken: currentUpdatedToken,
    intent: "checkout",
    locale: "en",
    returnTo: "https://evil.example/steal",
  });
  const safeReturnConsume = await browserRequest(callbackPage, "/api/auth/email-link/recovery", "PUT", {
    idToken: currentUpdatedToken,
    state: safeReturnStart.state,
  });
  assert(safeReturnConsume.status === 200, "external_return_path_rejected_without_safe_fallback");
  const safeMetadata = safeReturnConsume.body;
  assert(safeMetadata.returnTo === "/en", "external_return_path_not_reduced_to_locale_root");

  result = {
    callbackFinalPath: callbackFinalUrl.pathname + callbackFinalUrl.search,
    console: consoleSummary,
    cookieFlags: "session_http_only_secure_lax",
    cases: {
      crossOrigin: crossOriginResponse.status(),
      emailMismatch: emailMismatchResponse.status,
      externalReturn: safeReturnConsume.status,
      replay: replayResponse.status,
      tamperedCookie: tamperedResponse.status,
      uidMismatch: uidMismatchResponse.status,
      unverifiedEmail: unverifiedConsume.status,
    },
    concurrentConsume: concurrentStatuses,
    network,
    sessionContext: customerContextResponse.status,
    sensitiveValuesPrinted: false,
  };
} finally {
  if (typeof releaseSessionRequest === "function") releaseSessionRequest();
  await context.close();
  await browser.close();
  await Promise.all(identities.map((uid) => deleteUser(adminAuth, uid)));
}

console.log(JSON.stringify(result));
