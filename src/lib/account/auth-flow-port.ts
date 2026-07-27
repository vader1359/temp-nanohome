import "server-only";

import type { AccountAuthFlowOutcome, AccountAuthFlowRequest } from "./auth-flow";

export interface AccountAuthFlowPort {
  readonly submit: (request: AccountAuthFlowRequest) => Promise<AccountAuthFlowOutcome>;
}

export function createFakeAccountAuthFlowPort(): AccountAuthFlowPort {
  return {
    async submit(request) {
      switch (request.method) {
        case "magic_link":
          switch (request.action) {
            case "start":
              return { kind: "verification_required", method: "magic_link", returnTo: request.returnTo };
            case "verify":
              return { kind: "completed", returnTo: request.returnTo };
          }
        case "password":
        case "google":
        case "kakao":
          return { kind: "completed", returnTo: request.returnTo };
        case "phone_otp":
          switch (request.action) {
            case "start":
              return { kind: "verification_required", method: "phone_otp", returnTo: request.returnTo };
            case "verify":
              return request.otp === "123456"
                ? { kind: "completed", returnTo: request.returnTo }
                : { kind: "retryable_error" };
          }
      }
    },
  };
}
