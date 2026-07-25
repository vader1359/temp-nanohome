import type { AccountAuthFlowMethod, AccountAuthFlowOutcome } from "@/lib/account/auth-flow";

export type AccountAuthFlowState =
  | Readonly<{ readonly kind: "selecting"; readonly method: AccountAuthFlowMethod }>
  | Readonly<{ readonly kind: "submitting"; readonly method: AccountAuthFlowMethod }>
  | Readonly<{ readonly kind: "verifying"; readonly method: "magic_link" | "phone_otp"; readonly returnTo: string }>
  | Readonly<{ readonly kind: "retryable_error"; readonly method: AccountAuthFlowMethod }>
  | Readonly<{ readonly kind: "completed"; readonly returnTo: string }>;

export type AccountAuthFlowEvent =
  | Readonly<{ readonly kind: "choose"; readonly method: AccountAuthFlowMethod }>
  | Readonly<{ readonly kind: "submit" }>
  | Readonly<{ readonly kind: "outcome"; readonly outcome: AccountAuthFlowOutcome }>
  | Readonly<{ readonly kind: "back" }>
  | Readonly<{ readonly kind: "change_method" }>;

export const initialAccountAuthFlowState: AccountAuthFlowState = { kind: "selecting", method: "magic_link" };

function assertNever(value: never): never {
  throw new Error(`Unexpected auth flow state: ${JSON.stringify(value)}`);
}

export function reduceAccountAuthFlow(state: AccountAuthFlowState, event: AccountAuthFlowEvent): AccountAuthFlowState {
  switch (event.kind) {
    case "choose":
      return { kind: "selecting", method: event.method };
    case "submit":
      switch (state.kind) {
        case "selecting":
        case "retryable_error":
        case "verifying":
          return { kind: "submitting", method: state.method };
        case "submitting":
        case "completed":
          return state;
        default:
          return assertNever(state);
      }
    case "outcome":
      switch (event.outcome.kind) {
        case "completed":
          return { kind: "completed", returnTo: event.outcome.returnTo };
        case "retryable_error":
          return { kind: "retryable_error", method: state.kind === "submitting" ? state.method : "magic_link" };
        case "verification_required":
          return { kind: "verifying", method: event.outcome.method, returnTo: event.outcome.returnTo };
        default:
          return assertNever(event.outcome);
      }
    case "back":
      switch (state.kind) {
        case "verifying":
        case "retryable_error":
          return { kind: "selecting", method: state.method };
        case "selecting":
        case "submitting":
        case "completed":
          return state;
        default:
          return assertNever(state);
      }
    case "change_method":
      return initialAccountAuthFlowState;
    default:
      return assertNever(event);
  }
}
