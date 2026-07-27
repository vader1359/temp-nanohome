import { describe, expect, it, vi } from "vitest";
import { AccountId, ExternalPrincipalSubject, ServerSessionCookie } from "./account-session";
import {
  FIREBASE_SESSION_COOKIE,
  firebaseSessionCookieOptions,
  createFirebaseSessionVerifier,
  type FirebaseSessionClaims,
} from "./auth/firebase-session-verifier.server";
import { createAccountSessionVerifier } from "./auth/account-session-provider.server";

const PROJECT_ID = "nanohome-test";
const ACCOUNT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const validClaims = (overrides: Partial<FirebaseSessionClaims> = {}): FirebaseSessionClaims => ({
  sub: "firebase|customer_123",
  uid: "firebase|customer_123",
  aud: PROJECT_ID,
  iss: `https://session.firebase.google.com/${PROJECT_ID}`,
  exp: 2_000_000_000,
  iat: 1_900_000_000,
  ...overrides,
});

describe("Firebase server account session verification", () => {
  it("maps a non-UUID Firebase subject to an internal account UUID", async () => {
    // Given
    const verifySessionCookie = vi.fn(async () => validClaims());
    const resolveOrProvision = vi.fn(async () => new AccountId(ACCOUNT_ID));
    const verifier = createFirebaseSessionVerifier({
      projectId: PROJECT_ID,
      verifySessionCookie,
      accounts: { resolveOrProvision },
    });

    // When
    const session = await verifier.verify(new ServerSessionCookie("valid-cookie"));

    // Then
    expect(session?.accountId.value).toBe(ACCOUNT_ID);
    expect(session?.externalSubject).toEqual(new ExternalPrincipalSubject("firebase|customer_123"));
    expect(resolveOrProvision).toHaveBeenCalledWith(new ExternalPrincipalSubject("firebase|customer_123"));
    expect(verifySessionCookie).toHaveBeenCalledWith("valid-cookie", true);
  });

  it.each([
    ["wrong project", { aud: "other-project" }],
    ["wrong issuer", { iss: "https://session.firebase.google.com/other-project" }],
    ["subject mismatch", { sub: "firebase|one", uid: "firebase|two" }],
  ])("rejects %s claims", async (_case, overrides) => {
    // Given
    const verifier = createFirebaseSessionVerifier({
      projectId: PROJECT_ID,
      verifySessionCookie: async () => validClaims(overrides),
      accounts: { resolveOrProvision: async () => new AccountId(ACCOUNT_ID) },
    });

    // When
    const session = await verifier.verify(new ServerSessionCookie("invalid-claims"));

    // Then
    expect(session).toBeNull();
  });

  it.each(["auth/session-cookie-revoked", "auth/session-cookie-expired", "auth/argument-error"])(
    "treats Firebase %s verification failure as unauthenticated",
    async (code) => {
      // Given
      const verifier = createFirebaseSessionVerifier({
        projectId: PROJECT_ID,
        verifySessionCookie: async () => { throw new Error(code); },
        accounts: { resolveOrProvision: async () => new AccountId(ACCOUNT_ID) },
      });

      // When
      const session = await verifier.verify(new ServerSessionCookie("invalid-cookie"));

      // Then
      expect(session).toBeNull();
    },
  );

  it("rejects a verified subject when no account mapping can be resolved", async () => {
    // Given
    const verifier = createFirebaseSessionVerifier({
      projectId: PROJECT_ID,
      verifySessionCookie: async () => validClaims(),
      accounts: { resolveOrProvision: async () => null },
    });

    // When
    const session = await verifier.verify(new ServerSessionCookie("valid-cookie"));

    // Then
    expect(session).toBeNull();
  });

  it("uses a strict __Host- session cookie without a Domain attribute", () => {
    // Given / When
    const options = firebaseSessionCookieOptions(3_600);

    // Then
    expect(FIREBASE_SESSION_COOKIE).toBe("__Host-nanohome-session");
    expect(options).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 3_600 });
    expect(options).not.toHaveProperty("domain");
  });

  it("does not expose bearer credentials in account sessions", async () => {
    // Given
    const verifier = createFirebaseSessionVerifier({
      projectId: PROJECT_ID,
      verifySessionCookie: async () => validClaims(),
      accounts: { resolveOrProvision: async () => new AccountId(ACCOUNT_ID) },
    });

    // When
    const session = await verifier.verify(new ServerSessionCookie("valid-cookie"));

    // Then
    expect(session).not.toHaveProperty("bearerToken");
    expect(session).not.toHaveProperty("accessToken");
    expect(session).not.toHaveProperty("supabaseToken");
  });
});

describe("account session provider composition", () => {
  it("keeps the default Supabase provider lazy and avoids Firebase loading", async () => {
    // Given
    const loadFirebase = vi.fn();
    const verifier = createAccountSessionVerifier({ authProvider: undefined, loadFirebase });

    // When
    const session = await verifier.verify(new ServerSessionCookie("unused"));

    // Then
    expect(session).toBeNull();
    expect(loadFirebase).not.toHaveBeenCalled();
  });

  it("loads Firebase only when the provider is explicitly selected", async () => {
    // Given
    const firebaseVerifier = { verify: vi.fn(async () => null) };
    const loadFirebase = vi.fn(async () => firebaseVerifier);
    const verifier = createAccountSessionVerifier({ authProvider: "firebase", loadFirebase });
    const cookie = new ServerSessionCookie("cookie");

    // When
    await verifier.verify(cookie);

    // Then
    expect(loadFirebase).toHaveBeenCalledOnce();
    expect(firebaseVerifier.verify).toHaveBeenCalledWith(cookie);
  });
});
