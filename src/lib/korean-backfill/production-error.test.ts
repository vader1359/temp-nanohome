import { describe, expect, it } from "vitest";

import { productionApplyErrorMessage } from "./production-error";

describe("productionApplyErrorMessage", () => {
  it("reports safe PostgREST error fields", () => {
    // Given: a PostgREST-shaped RPC error without an Error prototype
    const error = {
      code: "42883",
      details: "No function matches the given name and argument types.",
      hint: "Try adding explicit type casts.",
      message: "function does not exist",
    };

    // When: the terminal apply boundary formats the failure
    const message = productionApplyErrorMessage(error);

    // Then: the operator receives actionable server diagnostics
    expect(message).toContain("42883");
    expect(message).toContain("function does not exist");
  });

  it("reports nullable PostgREST diagnostic fields", () => {
    // Given: a PostgREST error whose optional fields are null
    const error = { code: "PGRST202", details: null, hint: null, message: "schema cache is stale" };

    // When: the terminal apply boundary formats the failure
    const message = productionApplyErrorMessage(error);

    // Then: non-null diagnostics remain actionable
    expect(message).toBe("PGRST202 | schema cache is stale");
  });

  it("reports structured validation failures", () => {
    // Given: a schema validation failure without the native Error prototype
    const error = {
      issues: [{ code: "invalid_type", message: "Required", path: ["runId"] }],
    };

    // When: the terminal apply boundary formats the failure
    const message = productionApplyErrorMessage(error);

    // Then: the rejected RPC response is identifiable without dumping payloads
    expect(message).toBe("invalid_type:runId:Required");
  });

  it("distinguishes undefined rejections", () => {
    // Given: a rejected operation without an error payload
    const error = undefined;

    // When: the terminal apply boundary formats the failure
    const message = productionApplyErrorMessage(error);

    // Then: the missing rejection value remains observable
    expect(message).toBe("production apply rejected with undefined");
  });

  it("identifies opaque object shapes without printing their values", () => {
    // Given: an opaque SDK response with a diagnostic property
    const error = Object.create(null);
    Object.defineProperty(error, "traceId", { value: "private", enumerable: false });

    // When: the terminal apply boundary formats the failure
    const message = productionApplyErrorMessage(error);

    // Then: only the object shape and field name are exposed
    expect(message).toContain("keys=traceId");
    expect(message).not.toContain("private");
  });
});
