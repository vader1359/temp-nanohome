export type ZaloPayStateResult =
  | { readonly kind: "paid" }
  | { readonly kind: "query_required" }
  | { readonly kind: "processing" }
  | { readonly kind: "unpaid" }
  | { readonly kind: "manual_review" };

export const interpretZaloPayRedirect = (): ZaloPayStateResult => ({ kind: "query_required" });

export const applyZaloPayCallback = (input: Readonly<{ readonly current: string; readonly verified: boolean; readonly resultCode: number }>): ZaloPayStateResult => {
  if (input.current === "paid") return { kind: "paid" };
  if (input.verified && input.resultCode === 1) return { kind: "paid" };
  return { kind: "manual_review" };
};

export const applyZaloPayQuery = (input: Readonly<{ readonly current: string; readonly resultCode: number }>): ZaloPayStateResult => {
  if (input.current === "paid" || input.resultCode === 1) return { kind: "paid" };
  if (input.resultCode === 3) return { kind: "processing" };
  if (input.resultCode === 0) return { kind: "unpaid" };
  return { kind: "manual_review" };
};

export type ZaloPayCreateRetryDecision =
  | { readonly kind: "query_before_retry" }
  | { readonly kind: "do_not_retry" };

export const decideCreateRetry = (failure: string): ZaloPayCreateRetryDecision => failure === "timeout_after_submission" ? { kind: "query_before_retry" } : { kind: "do_not_retry" };
