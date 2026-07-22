import { describe, expect, it, vi } from "vitest";

import { hasCurrentAiProcessingConsent } from "./consent-adapter";

const token = "a".repeat(64);

function request(cookie?: string): Request {
  return new Request("https://nanohome.test/api/chat", {
    headers: cookie === undefined ? {} : { cookie },
  });
}

function repository(aiProcessing: boolean, withdrawn = false) {
  return {
    resolveIdentity: vi.fn(async () => ({
      identity: { visitorId: "visitor-one", sessionId: "session-one" },
      status: "active" as const,
    })),
    currentConsent: vi.fn(async () => ({
      essential: true as const,
      aiProcessing,
      withdrawn,
    })),
  };
}

describe("public chat AI-processing consent verifier", () => {
  it("accepts only an active identity with current non-withdrawn AI consent", async () => {
    const repo = repository(true);
    const allowed = await hasCurrentAiProcessingConsent(
      request(`nano_visitor_id=${token}; nano_session_id=${token}`),
      repo,
    );

    expect(allowed).toBe(true);
    expect(repo.resolveIdentity).toHaveBeenCalledOnce();
    expect(repo.currentConsent).toHaveBeenCalledWith({
      visitorId: "visitor-one",
      sessionId: "session-one",
    });
  });

  it.each([
    [false, false],
    [true, true],
  ] as const)(
    "denies aiProcessing=%s withdrawn=%s",
    async (aiProcessing, withdrawn) => {
      await expect(hasCurrentAiProcessingConsent(
        request(`nano_visitor_id=${token}; nano_session_id=${token}`),
        repository(aiProcessing, withdrawn),
      )).resolves.toBe(false);
    },
  );

  it("denies missing or malformed identity cookies without a repository lookup", async () => {
    const repo = repository(true);

    await expect(hasCurrentAiProcessingConsent(request(), repo)).resolves.toBe(false);
    await expect(hasCurrentAiProcessingConsent(
      request("nano_visitor_id=bad; nano_session_id=bad"),
      repo,
    )).resolves.toBe(false);
    expect(repo.resolveIdentity).not.toHaveBeenCalled();
  });

  it("fails closed when identity or consent storage is unavailable", async () => {
    const repo = repository(true);
    repo.resolveIdentity.mockRejectedValueOnce(new Error("private outage"));

    await expect(hasCurrentAiProcessingConsent(
      request(`nano_visitor_id=${token}; nano_session_id=${token}`),
      repo,
    )).resolves.toBe(false);
  });
});
