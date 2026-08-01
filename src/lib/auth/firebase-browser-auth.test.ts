import type { Auth, User } from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFirebaseBrowserAuth = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn(async () => undefined));
const applyActionCode = vi.hoisted(() => vi.fn(async () => undefined));
const checkActionCode = vi.hoisted(() => vi.fn(async () => ({ operation: "VERIFY_AND_CHANGE_EMAIL" })));
const verifyBeforeUpdateEmail = vi.hoisted(() => vi.fn<(
  user: unknown,
  email: string,
  settings: Readonly<{ handleCodeInApp: boolean; url: string }>,
) => Promise<void>>().mockResolvedValue(undefined));

vi.mock("@/lib/auth/firebase-client", () => ({ getFirebaseBrowserAuth }));
vi.mock("firebase/auth", () => ({
  ActionCodeOperation: {
    VERIFY_AND_CHANGE_EMAIL: "VERIFY_AND_CHANGE_EMAIL",
    VERIFY_EMAIL: "VERIFY_EMAIL",
  },
  GoogleAuthProvider: class GoogleAuthProvider {},
  RecaptchaVerifier: class RecaptchaVerifier {},
  applyActionCode,
  browserSessionPersistence: {},
  checkActionCode,
  getRedirectResult: vi.fn(),
  linkWithPhoneNumber: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut,
  setPersistence: vi.fn(),
  verifyBeforeUpdateEmail,
}));

import { FirebaseAuthUiError, getFirebaseBrowserAuthPort } from "./firebase-browser-auth";

const csrfToken = "csrf-token-with-at-least-thirty-two-characters";
const recoveryState = "s".repeat(43);

function createAuth(user: User | null): Auth {
  return {
    app: { options: { projectId: "temp-nanohome" } },
    authStateReady: vi.fn(async () => undefined),
    currentUser: user,
    languageCode: null,
    settings: { appVerificationDisabledForTesting: false },
  } as unknown as Auth;
}

function recoveryFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (href.startsWith("/api/auth/email-link/recovery?")) {
      return Response.json({ valid: true });
    }
    if (href === "/api/auth/email-link/recovery" && init?.method === "PUT") {
      return Response.json({ intent: "checkout", locale: "vi", returnTo: "/vi/checkout" });
    }
    if (href === "/api/auth/session" && init?.method === "GET") {
      return Response.json({ csrfToken });
    }
    if (href === "/api/auth/session" && init?.method === "POST") {
      return Response.json({ returnTo: "/vi/checkout" });
    }
    throw new Error(`Unexpected request: ${href} ${init?.method ?? "GET"}`);
  });
}

describe("Firebase email-link recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a server-bound transaction without placing identity or returnTo in the callback URL", async () => {
    const user = {
      getIdToken: vi.fn(async () => "id-token"),
    } as unknown as User;
    const auth = createAuth(user);
    getFirebaseBrowserAuth.mockResolvedValue(auth);
    const fetchMock = vi.fn<(
      url: string | URL | Request,
      init?: RequestInit,
    ) => Promise<Response>>().mockResolvedValue(Response.json({ state: recoveryState }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const state = await getFirebaseBrowserAuthPort().verifyEmailBeforeUpdate(
      user,
      "verified@example.test",
      "vi",
      "/vi/checkout?auth=login",
      "checkout",
    );

    expect(state).toBe(recoveryState);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/email-link/recovery", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      email: "verified@example.test",
      intent: "checkout",
      returnTo: "/vi/checkout?auth=login",
    });
    expect(verifyBeforeUpdateEmail).toHaveBeenCalledWith(user, "verified@example.test", {
      handleCodeInApp: false,
      url: `${window.location.origin}/vi/auth/email-link?state=${recoveryState}`,
    });
    expect(verifyBeforeUpdateEmail.mock.calls[0]?.[2].url).not.toContain("verified@example.test");
    expect(verifyBeforeUpdateEmail.mock.calls[0]?.[2].url).not.toContain("checkout");
  });

  it("validates identity-bound recovery before exchanging one checkout session", async () => {
    const user = {
      email: "verified@example.test",
      emailVerified: true,
      getIdToken: vi.fn(async () => "id-token"),
      phoneNumber: null,
      reload: vi.fn(async () => undefined),
      uid: "email-only-user",
    } as unknown as User;
    getFirebaseBrowserAuth.mockResolvedValue(createAuth(user));
    const fetchMock = recoveryFetch();
    vi.stubGlobal("fetch", fetchMock);

    const destination = await getFirebaseBrowserAuthPort().recoverEmailLinkSession({
      locale: "vi",
      state: recoveryState,
    });

    expect(destination).toBe("/vi/checkout");
    expect(user.reload).toHaveBeenCalledOnce();
    expect(user.getIdToken).toHaveBeenCalledWith(true);
    const consumeCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PUT");
    expect(JSON.parse(String(consumeCall?.[1]?.body))).toEqual({ idToken: "id-token", state: recoveryState });
    const sessionCall = fetchMock.mock.calls.find((call) => call[0] === "/api/auth/session" && call[1]?.method === "POST");
    expect(JSON.parse(String(sessionCall?.[1]?.body))).toMatchObject({
      intent: "checkout",
      locale: "vi",
      returnTo: "/vi/checkout",
    });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("validates and applies a custom Firebase action code before session recovery", async () => {
    const user = {
      getIdToken: vi.fn(async () => "id-token"),
      reload: vi.fn(async () => undefined),
    } as unknown as User;
    getFirebaseBrowserAuth.mockResolvedValue(createAuth(user));
    vi.stubGlobal("fetch", recoveryFetch());

    await getFirebaseBrowserAuthPort().recoverEmailLinkSession({
      actionCode: "one-time-code",
      locale: "vi",
      mode: "verifyAndChangeEmail",
      state: recoveryState,
    });

    expect(checkActionCode).toHaveBeenCalledWith(expect.anything(), "one-time-code");
    expect(applyActionCode).toHaveBeenCalledWith(expect.anything(), "one-time-code");
    expect(checkActionCode.mock.invocationCallOrder[0]).toBeLessThan(applyActionCode.mock.invocationCallOrder[0] ?? 0);
  });

  it("returns null only after validating state when the callback tab has no user", async () => {
    getFirebaseBrowserAuth.mockResolvedValue(createAuth(null));
    const fetchMock = recoveryFetch();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFirebaseBrowserAuthPort().recoverEmailLinkSession({ locale: "en", state: recoveryState }))
      .resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(`state=${recoveryState}`);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("fails closed before Firebase auth when recovery state is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "recovery_invalid" }, { status: 400 })));

    await expect(getFirebaseBrowserAuthPort().recoverEmailLinkSession({ locale: "en", state: "invalid" }))
      .rejects.toEqual(new FirebaseAuthUiError("email_link_invalid"));
    expect(getFirebaseBrowserAuth).not.toHaveBeenCalled();
  });

  it("maps a replayed recovery transaction to the already-used UI state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "recovery_replayed" }, { status: 409 })));

    await expect(getFirebaseBrowserAuthPort().recoverEmailLinkSession({ locale: "en", state: recoveryState }))
      .rejects.toEqual(new FirebaseAuthUiError("email_link_used"));
    expect(getFirebaseBrowserAuth).not.toHaveBeenCalled();
  });

  it.each([
    ["auth/expired-action-code", "code_expired"],
    ["auth/invalid-action-code", "email_link_invalid"],
  ] as const)("maps Firebase %s to %s", async (firebaseCode, expectedCode) => {
    getFirebaseBrowserAuth.mockResolvedValue(createAuth(null));
    vi.stubGlobal("fetch", recoveryFetch());
    checkActionCode.mockRejectedValueOnce({ code: firebaseCode });

    await expect(getFirebaseBrowserAuthPort().recoverEmailLinkSession({
      actionCode: "one-time-code",
      locale: "en",
      mode: "verifyEmail",
      state: recoveryState,
    })).rejects.toEqual(new FirebaseAuthUiError(expectedCode));
  });

  it("rejects a non-verification Firebase action mode before inspecting its code", async () => {
    getFirebaseBrowserAuth.mockResolvedValue(createAuth(null));
    vi.stubGlobal("fetch", recoveryFetch());

    await expect(getFirebaseBrowserAuthPort().recoverEmailLinkSession({
      actionCode: "password-reset-code",
      locale: "en",
      mode: "resetPassword",
      state: recoveryState,
    })).rejects.toEqual(new FirebaseAuthUiError("email_link_invalid"));
    expect(checkActionCode).not.toHaveBeenCalled();
  });
});
