import "server-only";

import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { getCurrentFirebaseSessionClaims } from "@/lib/auth/firebase-session.server";

import { createAccountDataRepository, type AccountDataRepository } from "./account-data-repository.server";
import { createFirebaseAccountAuthPort } from "./auth-port";
import { createAccountCartPort } from "./cart-port";
import { createAccountOrdersPort } from "./orders-port";
import { createAccountProfilePort } from "./profile-port";
import { createAccountWishlistPort } from "./wishlist-port";
import { createFakeAccountOffersPort } from "./offers-port";
import { createFakeAccountPreferencesPort } from "./preferences-port";
import { createFakeAccountSecurityPort } from "./security-port";

let repository: AccountDataRepository | undefined;
function getRepository(): AccountDataRepository {
  repository ??= createAccountDataRepository({
    baseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    mutationsEnabled: env.ACCOUNT_CENTER_ENABLED === true,
    projectRef: env.SUPABASE_PROJECT_REF,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return repository;
}

const accountAuthPort = createFirebaseAccountAuthPort({
  getClaims: getCurrentFirebaseSessionClaims,
  getLocale: async () => {
    const cookieStore = await cookies();
    return getSupportedLocale(cookieStore.get("NEXT_LOCALE")?.value ?? null);
  },
  resolveAccountId: (firebaseUid) => getRepository().resolveAccountId(firebaseUid),
});
const ordersPort = createAccountOrdersPort({
  getOrder: (accountId, orderId) => getRepository().getOrder(accountId, orderId),
  listOrders: (accountId, page) => getRepository().listOrders(accountId, page),
}, env.AUTH_CSRF_SECRET);
const profilePort = createAccountProfilePort({
  getProfile: (accountId) => getRepository().getProfile(accountId),
  patchProfile: (accountId, patch) => getRepository().patchProfile(accountId, patch),
});
const wishlistPort = createAccountWishlistPort({
  addWishlistItem: (accountId, variantId) => getRepository().addWishlistItem(accountId, variantId),
  listWishlistItems: (accountId) => getRepository().listWishlistItems(accountId),
  mergeWishlistItems: (accountId, key, variantIds) =>
    getRepository().mergeWishlistItems(accountId, key, variantIds),
  removeWishlistItem: (accountId, variantId) =>
    getRepository().removeWishlistItem(accountId, variantId),
});
const cartPort = createAccountCartPort({
  getCart: (accountId) => getRepository().getCart(accountId),
  mergeGuestCart: (accountId, key, items) =>
    getRepository().mergeGuestCart(accountId, key, items),
  mutateCart: (accountId, input) => getRepository().mutateCart(accountId, input),
});
const fakeOffersPort = createFakeAccountOffersPort();
const fakePreferencesPort = createFakeAccountPreferencesPort();
const fakeSecurityPort = createFakeAccountSecurityPort();

export function getAccountAuthPort() {
  return accountAuthPort;
}

export function getAccountOrdersPort() {
  return ordersPort;
}

export function getAccountProfilePort() {
  return profilePort;
}

export function getAccountCartPort() {
  return cartPort;
}

export function getAccountWishlistPort() {
  return wishlistPort;
}

export function getAccountOffersPort() {
  return fakeOffersPort;
}

export function getAccountPreferencesPort() {
  return fakePreferencesPort;
}

export function getAccountSecurityPort() {
  return fakeSecurityPort;
}
