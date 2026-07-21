import { describe, expect, it } from "vitest";
import { customerIdentityCookieNames, issueCustomerIdentity, readCustomerIdentity } from "./identity";

describe("customer identity cookies", () => {
  it("issues two distinct opaque cookies with the required policy", () => {
    const issued = issueCustomerIdentity();

    expect(issued.visitorId).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.sessionId).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.visitorId).not.toBe(issued.sessionId);
    expect(issued.cookies).toHaveLength(2);
    expect(issued.cookies.every((cookie) => cookie.httpOnly && cookie.secure && cookie.sameSite === "lax")).toBe(true);
    expect(issued.cookies.map((cookie) => cookie.name)).toEqual([
      customerIdentityCookieNames.visitor,
      customerIdentityCookieNames.session,
    ]);
  });

  it("reads only generated opaque cookie values", () => {
    const visitor = "a".repeat(64);
    const session = "b".repeat(64);
    expect(readCustomerIdentity({ visitor, session })).toEqual({ visitorId: visitor, sessionId: session });
    expect(readCustomerIdentity({ visitor: "visitor-token", session: "session-token" })).toBeNull();
    expect(readCustomerIdentity({ visitor: "", session })).toBeNull();
  });
});
