import type { Auth, User } from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getFirebaseBrowserAuth = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/auth/firebase-client", () => ({ getFirebaseBrowserAuth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  RecaptchaVerifier: class RecaptchaVerifier {},
  browserSessionPersistence: {},
  getRedirectResult: vi.fn(),
  linkWithPhoneNumber: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut,
  setPersistence: vi.fn(),
  verifyBeforeUpdateEmail: vi.fn(),
}));

import { getFirebaseBrowserAuthPort } from "./firebase-browser-auth";

const csrfToken = "csrf-token-with-at-least-thirty-two-characters";

function createAuth(user: User | null): Auth {
  return {
    app: { options: { projectId: "temp-nanohome" } },
    authStateReady: vi.fn(async () => undefined),
    currentUser: user,
    settings: { appVerificationDisabledForTesting: false },
  } as unknown as Auth;
}

describe("Firebase email-link recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ returnTo: "/vi/checkout" }), { status: 200 })));
  });

  it("reloads the restored Firebase user and exchanges one session without phone OTP", async () => {
    const user = {
      email: "verified@example.test",
      emailVerified: true,
      getIdToken: vi.fn(async () => "id-token"),
      phoneNumber: null,
      reload: vi.fn(async () => undefined),
      uid: "email-only-user",
    } as unknown as User;
    getFirebaseBrowserAuth.mockResolvedValue(createAuth(user));

    const destination = await getFirebaseBrowserAuthPort().recoverEmailLinkSession("vi", "/vi/checkout", "checkout");

    expect(destination).toBe("/vi/checkout");
    expect(user.reload).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1]?.[1]?.body as string)).toMatchObject({
      intent: "checkout",
      locale: "vi",
      returnTo: "/vi/checkout",
    });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("returns null without creating a session when the callback tab has no user", async () => {
    getFirebaseBrowserAuth.mockResolvedValue(createAuth(null));

    await expect(getFirebaseBrowserAuthPort().recoverEmailLinkSession("en", "/en/checkout", "checkout"))
      .resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
