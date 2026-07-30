import "server-only";

import { cookies } from "next/headers";

import { env } from "@/lib/env";
import {
  createCustomerPrecreationRepository,
  resolveCustomerAccountClaim,
} from "@/lib/amis/customer-claim.server";
import { getSupportedLocale } from "@/lib/auth/redirect";
import { getCurrentFirebaseSessionClaims } from "@/lib/auth/firebase-session.server";

import { createAccountDataRepository, type AccountDataRepository } from "./account-data-repository.server";
import {
  createAccountIdentityResolver,
} from "./account-identity-resolver.server";
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
  resolveVerifiedContactKinds: env.ACCOUNT_CENTER_ENABLED === true
    ? (accountId) => getRepository().getVerifiedContactKinds(accountId)
    : undefined,
});
const precreationEnvironment = resolvePrecreationEnvironment(
  env.NEXT_PUBLIC_APP_ORIGIN,
);
const customerPrecreationRepository = createCustomerPrecreationRepository({
  baseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  projectRef: env.SUPABASE_PROJECT_REF,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  writeGate: {
    assuranceReadsEnabled: env.ACCOUNT_CENTER_ENABLED === true,
    batchWritesEnabled: false,
    claimWritesEnabled: env.ACCOUNT_CENTER_ENABLED === true,
    environment: precreationEnvironment,
    productionApproval: false,
  },
});
const accountIdentityResolver = createAccountIdentityResolver({
  lookupSecret: env.AUTH_CSRF_SECRET,
  repository: {
    resolveOrCreateAccount: (input) => getRepository().resolveOrCreateAccount(input),
  },
  resolveCustomerClaim: (claim) => resolveCustomerAccountClaim({
    auditHmacKey: env.AUTH_CSRF_SECRET,
    claim,
    repository: customerPrecreationRepository,
  }),
});
const ordersPort = createAccountOrdersPort({
  getOrder: (accountId, orderId) => getRepository().getOrder(accountId, orderId),
  listOrders: (accountId, page) => getRepository().listOrders(accountId, page),
}, env.AUTH_CSRF_SECRET);
const profilePort = createAccountProfilePort({
  getProfile: (accountId) => getRepository().getProfile(accountId),
  getVerifiedContactKinds: (accountId) => getRepository().getVerifiedContactKinds(accountId),
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

export function getAccountIdentityResolver() {
  return accountIdentityResolver;
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

function resolvePrecreationEnvironment(
  appOrigin: string | undefined,
): "local" | "production" | "staging" {
  if (appOrigin === undefined) return "production";
  const hostname = new URL(appOrigin).hostname;
  if (
    hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
  ) {
    return "local";
  }
  return hostname === "staging.nanohome.vn" ? "staging" : "production";
}
