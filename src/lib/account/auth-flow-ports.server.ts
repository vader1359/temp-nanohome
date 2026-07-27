import "server-only";

import { createFakeAccountAuthFlowPort } from "./auth-flow-port";

const fakeAccountAuthFlowPort = createFakeAccountAuthFlowPort();

export function getAccountAuthFlowPort() {
  return fakeAccountAuthFlowPort;
}
