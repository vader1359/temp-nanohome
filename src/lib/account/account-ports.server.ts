import "server-only";

import { createFakeAccountAuthPort } from "./auth-port";
import { createFakeAccountOrdersPort } from "./orders-port";
import { createFakeAccountProfilePort } from "./profile-port";
import { createFakeAccountWishlistPort } from "./wishlist-port";

const anonymousAuthPort = createFakeAccountAuthPort(null);
const fakeOrdersPort = createFakeAccountOrdersPort();
const fakeProfilePort = createFakeAccountProfilePort();
const fakeWishlistPort = createFakeAccountWishlistPort();

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

export function getAccountWishlistPort() {
  return fakeWishlistPort;
}
