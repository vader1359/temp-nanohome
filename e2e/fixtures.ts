import { test as base, expect, type Page } from "@playwright/test";

// Playwright fixtures for nanohome-ecommerce e2e tests.
//
// Relevant env vars:
//   E2E_TEST_USER_EMAIL     — email of the Supabase test user
//   E2E_TEST_USER_PASSWORD  — password of the Supabase test user
//
// The test user is created via Supabase Auth once T15 lands (auth middleware).
// Until then the testUser/authedPage fixtures throw if the env vars are missing
// so specs that depend on auth fail loudly instead of silently passing.

export const TEST_USER_EMAIL_ENV = "E2E_TEST_USER_EMAIL";
export const TEST_USER_PASSWORD_ENV = "E2E_TEST_USER_PASSWORD";
export const CART_GUEST_ID_ENV = "E2E_CART_GUEST_ID";
export const DEFAULT_CART_GUEST_ID = "e2e-guest-cart-0001";
export const CART_STORAGE_KEY = "nanohome.cart.guestId";

export interface TestUserCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthFixtures {
  testUser: TestUserCredentials;
  authedPage: Page;
}

export interface CartState {
  readonly guestId: string;
  readonly storageKey: string;
}

export interface CartFixtures {
  cartState: CartState;
  cartPage: Page;
}

function readTestUser(): TestUserCredentials {
  const email = process.env[TEST_USER_EMAIL_ENV];
  const password = process.env[TEST_USER_PASSWORD_ENV];
  if (!email || !password) {
    throw new Error(
      `${TEST_USER_EMAIL_ENV} and ${TEST_USER_PASSWORD_ENV} must be set before using the testUser / authedPage fixtures. Create a Supabase test user (see plan task T15).`,
    );
  }
  return { email, password };
}

// The Playwright fixture runner passes a `use(expose)` callback as the second
// parameter of each fixture. ESLint's react-hooks/rules-of-hooks rule trips
// on any identifier whose name starts with "use", so we name the parameter
// `expose` instead of the conventional `use` to keep e2e lint clean without
// mutating eslint.config.mjs (out of scope for T8).
export const test = base.extend<AuthFixtures & CartFixtures>({
  testUser: async ({}, expose) => {
    await expose(readTestUser());
  },

  cartState: async ({}, expose) => {
    await expose({
      guestId: process.env[CART_GUEST_ID_ENV] ?? DEFAULT_CART_GUEST_ID,
      storageKey: CART_STORAGE_KEY,
    });
  },

  authedPage: async ({ page, testUser }, expose) => {
    // Stub: the real Supabase auth flow (sign-in via Supabase SSR helper and
    // seeding the auth cookies into the Playwright context) lands with the
    // auth middleware in plan task T15. Until then this fixture forwards a
    // bare page so downstream specs only opt in once auth is wired.
    void testUser;
    await page.goto("/");
    await expose(page);
  },

  cartPage: async ({ page, cartState }, expose) => {
    await page.addInitScript(
      ({ guestId, storageKey }: CartState) => {
        window.localStorage.setItem(storageKey, guestId);
      },
      cartState,
    );
    await page.goto("/");
    await expose(page);
  },
});

export { expect };
