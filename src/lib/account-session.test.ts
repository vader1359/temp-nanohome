import { describe, expect, it } from "vitest";
import {
  AccountId,
  AccountSession,
  AccountSessionVerifier,
  ExternalPrincipalSubject,
  ServerSessionCookie,
} from "./account-session";

describe("account session contract", () => {
  it("preserves a non-UUID external subject separately from the internal account ID", async () => {
    // Given
    const cookie = new ServerSessionCookie("firebase-session-cookie");
    const accountId = new AccountId("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    const subject = new ExternalPrincipalSubject("firebase|customer_123");
    const verifier: AccountSessionVerifier = {
      verify: async (receivedCookie) => receivedCookie.value === cookie.value
        ? new AccountSession(accountId, subject)
        : null,
    };

    // When
    const session = await verifier.verify(cookie);

    // Then
    expect(session?.accountId.value).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(session?.externalSubject.value).toBe("firebase|customer_123");
    expect(session?.accountId).not.toBe(session?.externalSubject);
  });

  it("resolves a missing or invalid session cookie as absent", async () => {
    // Given
    const verifier: AccountSessionVerifier = { verify: async () => null };

    // When
    const missing = await verifier.verify(new ServerSessionCookie(""));
    const invalid = await verifier.verify(new ServerSessionCookie("invalid-cookie"));

    // Then
    expect(missing).toBeNull();
    expect(invalid).toBeNull();
  });

  it("does not expose a Supabase bearer token from the account session", async () => {
    // Given
    const verifier: AccountSessionVerifier = {
      verify: async () => new AccountSession(
        new AccountId("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"),
        new ExternalPrincipalSubject("firebase|customer_123"),
      ),
    };

    // When
    const session = await verifier.verify(new ServerSessionCookie("firebase-session-cookie"));

    // Then
    expect(session).not.toHaveProperty("bearerToken");
    expect(session).not.toHaveProperty("accessToken");
    expect(session).not.toHaveProperty("supabaseToken");
  });
});
