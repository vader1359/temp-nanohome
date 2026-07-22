import type { ClientCustomerContext } from "@/lib/contracts/schemas";
import { consentRequestSchema, type ConsentRequest } from "./schema";

export type ConsentState = ConsentRequest & Readonly<{ essential: true }>;
export type ConsentLedger = Readonly<{
  record: (visitorId: string, request: ConsentRequest) => ConsentState;
  current: (visitorId: string) => ConsentState;
  project: (visitorId: string) => ClientCustomerContext["consent"];
  capabilities: (visitorId: string) => ClientCustomerContext["capabilities"];
}>;

const defaultState = (): ConsentState => ({ essential: true });

const effectiveState = (request: ConsentRequest): ConsentState => request.withdrawn === true
  ? { ...request, analytics: false, personalization: false, aiProcessing: false, aiConversationStorage: false, roomImageProcessing: false, roomImageStorage: false, marketing: false, essential: true }
  : { ...request, essential: true };

const projectState = (state: ConsentState): ClientCustomerContext["consent"] => ({
  analytics: state.analytics ?? false,
  personalization: state.personalization ?? false,
  aiProcessing: state.aiProcessing ?? false,
  aiConversationStorage: state.aiConversationStorage ?? false,
  roomImageProcessing: state.roomImageProcessing ?? false,
  roomImageStorage: state.roomImageStorage ?? false,
  version: state.version ?? "1",
});

const projectCapabilities = (state: ConsentState): ClientCustomerContext["capabilities"] => ({
  analyticsTracking: state.withdrawn !== true && state.analytics === true,
  marketingTracking: state.withdrawn !== true && state.marketing === true,
});

export const createConsentService = (): ConsentLedger => {
  const ledger = new Map<string, ConsentState>();
  const current = (visitorId: string): ConsentState => ledger.get(visitorId) ?? defaultState();

  return {
    record: (visitorId, request) => {
      const state = effectiveState(request);
      ledger.set(visitorId, state);
      return state;
    },
    current,
    project: (visitorId) => projectState(current(visitorId)),
    capabilities: (visitorId) => projectCapabilities(current(visitorId)),
  };
};

declare global {
  var __nanohomeConsentLedger: ConsentLedger | undefined;
}

export const consentLedger = globalThis.__nanohomeConsentLedger ?? createConsentService();
globalThis.__nanohomeConsentLedger = consentLedger;

export { consentRequestSchema };
