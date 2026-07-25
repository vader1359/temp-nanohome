import "server-only";

import { createFakeAccountAuthPort } from "./auth-port";
import { createFakeAccountProfilePort } from "./profile-port";

const anonymousAuthPort = createFakeAccountAuthPort(null);
const fakeProfilePort = createFakeAccountProfilePort();

/**
 * Development-only Account-lane ports. Foundation replaces these accessors
 * with its verified Firebase session adapter and durable profile repository.
 */
export function getAccountAuthPort() {
  return anonymousAuthPort;
}

export function getAccountProfilePort() {
  return fakeProfilePort;
}
