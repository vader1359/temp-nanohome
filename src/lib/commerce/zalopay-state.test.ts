import { describe, expect, it } from "vitest";

import {
  applyZaloPayCallback,
  applyZaloPayQuery,
  decideCreateRetry,
  interpretZaloPayRedirect,
} from "./zalopay-state";

describe("ZaloPay payment state", () => {
  it("never treats a redirect as paid", () => {
    expect(interpretZaloPayRedirect()).toEqual({ kind: "query_required" });
  });

  it("allows paid only from verified callback or successful query", () => {
    expect(applyZaloPayCallback({ current: "awaiting_customer", verified: true, resultCode: 1 })).toEqual({ kind: "paid" });
    expect(applyZaloPayQuery({ current: "awaiting_customer", resultCode: 1 })).toEqual({ kind: "paid" });
    expect(applyZaloPayCallback({ current: "awaiting_customer", verified: false, resultCode: 1 })).toEqual({ kind: "manual_review" });
    expect(applyZaloPayQuery({ current: "awaiting_customer", resultCode: 3 })).toEqual({ kind: "processing" });
    expect(applyZaloPayQuery({ current: "awaiting_customer", resultCode: 2 })).toEqual({ kind: "manual_review" });
  });

  it("makes duplicate callbacks idempotent", () => {
    expect(applyZaloPayCallback({ current: "paid", verified: true, resultCode: 1 })).toEqual({ kind: "paid" });
  });

  it("does not blindly retry an ambiguous create response", () => {
    expect(decideCreateRetry("timeout_after_submission")).toEqual({ kind: "query_before_retry" });
    expect(decideCreateRetry("rejected_before_submission")).toEqual({ kind: "do_not_retry" });
  });
});
