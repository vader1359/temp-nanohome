import "server-only";

import { createFakeAccountAuthPort } from "./auth-port";
import { createFakeAccountCartPort } from "./cart-port";
import { createFakeAccountOrdersPort } from "./orders-port";
import { createFakeAccountProfilePort } from "./profile-port";
import { createFakeAccountWishlistPort } from "./wishlist-port";
import { createFakeAccountOffersPort } from "./offers-port";
import { createFakeAccountPreferencesPort } from "./preferences-port";

const anonymousAuthPort = createFakeAccountAuthPort(null);
const fakeOrdersPort = createFakeAccountOrdersPort();
const fakeProfilePort = createFakeAccountProfilePort();
const fakeCartPort = createFakeAccountCartPort();
const fakeWishlistPort = createFakeAccountWishlistPort();
const fakeOffersPort = createFakeAccountOffersPort();
const fakePreferencesPort = createFakeAccountPreferencesPort();

/**
 * Development-only Account-lane ports. Foundation replaces these accessors
 * with its verified Firebase session adapter and durable profile and wishlist repositories.
 */
export function getAccountAuthPort() {
  return anonymousAuthPort;
}

export function getAccountOrdersPort() {
  return fakeOrdersPort;
}

export function getAccountProfilePort() {
  return fakeProfilePort;
}

export function getAccountCartPort() {
  return fakeCartPort;
}

export function getAccountWishlistPort() {
  return fakeWishlistPort;
}

export function getAccountOffersPort() {
  return fakeOffersPort;
}

export function getAccountPreferencesPort() {
  return fakePreferencesPort;
}
