"use client";

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  browserSessionPersistence,
  getRedirectResult,
  linkWithPhoneNumber,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  setPersistence,
  verifyBeforeUpdateEmail,
  type Auth,
  type ConfirmationResult,
  type User,
} from "firebase/auth";

import { getFirebaseBrowserAuth } from "./firebase-client";
import { isFirebasePhoneTestModeAllowed } from "./firebase-phone-test-mode";
import type { AuthSessionIntent } from "./session-intent";

const GOOGLE_REDIRECT_MARKER = "nanohome-google-redirect-pending";

export type FirebaseAuthUiErrorCode =
  | "code_expired"
  | "invalid_code"
  | "invalid_credentials"
  | "invalid_phone"
  | "captcha_failed"
  | "network"
  | "popup_closed"
  | "popup_blocked"
  | "operation_not_allowed"
  | "too_many_requests"
  | "unverified_email"
  | "account_conflict"
  | "email_verification_pending"
  | "recent_sign_in_required"
  | "unauthorized_domain"
  | "unknown";

export class FirebaseAuthUiError extends Error {
  constructor(readonly code: FirebaseAuthUiErrorCode) {
    super(code);
    this.name = "FirebaseAuthUiError";
  }
}

export type FirebasePhoneConfirmation = Readonly<{
  confirm: (code: string) => Promise<User>;
}>;

export interface FirebaseBrowserAuthPort {
  readonly requestPhoneCode: (phone: string, recaptchaContainerId: string, linkUser?: User) => Promise<FirebasePhoneConfirmation>;
  readonly signInGoogle: () => Promise<User>;
  readonly startGoogleRedirect: () => Promise<void>;
  readonly consumeGoogleRedirect: () => Promise<User | null>;
  readonly signInPassword: (email: string, password: string) => Promise<User>;
  readonly sendPasswordReset: (email: string, locale: string) => Promise<void>;
  readonly verifyEmailBeforeUpdate: (user: User, email: string, locale: string, returnTo: string) => Promise<void>;
  readonly reloadUser: (user: User) => Promise<User>;
  readonly createServerSession: (user: User, locale: string, returnTo: string, intent?: AuthSessionIntent) => Promise<string>;
  readonly clearPhoneVerifier: () => void;
}

function mapFirebaseError(error: unknown): FirebaseAuthUiError {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

  switch (code) {
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return new FirebaseAuthUiError("invalid_phone");
    case "auth/invalid-verification-code":
    case "auth/missing-verification-code":
      return new FirebaseAuthUiError("invalid_code");
    case "auth/code-expired":
    case "auth/session-expired":
      return new FirebaseAuthUiError("code_expired");
    case "auth/too-many-requests":
    case "auth/quota-exceeded":
      return new FirebaseAuthUiError("too_many_requests");
    case "auth/network-request-failed":
      return new FirebaseAuthUiError("network");
    case "auth/unauthorized-domain":
      return new FirebaseAuthUiError("unauthorized_domain");
    case "auth/operation-not-allowed":
      return new FirebaseAuthUiError("operation_not_allowed");
    case "auth/captcha-check-failed":
    case "auth/missing-app-credential":
    case "auth/invalid-app-credential":
      return new FirebaseAuthUiError("captcha_failed");
    case "auth/popup-blocked":
      return new FirebaseAuthUiError("popup_blocked");
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return new FirebaseAuthUiError("popup_closed");
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/user-disabled":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return new FirebaseAuthUiError("invalid_credentials");
    case "auth/credential-already-in-use":
    case "auth/email-already-in-use":
    case "auth/provider-already-linked":
      return new FirebaseAuthUiError("account_conflict");
    case "auth/requires-recent-login":
      return new FirebaseAuthUiError("recent_sign_in_required");
    default:
      return new FirebaseAuthUiError("unknown");
  }
}

function parseSessionResponse(input: unknown): string {
  if (typeof input !== "object" || input === null || !("returnTo" in input) || typeof input.returnTo !== "string") {
    throw new FirebaseAuthUiError("unknown");
  }
  return input.returnTo;
}

function parseCsrfResponse(input: unknown): string {
  if (typeof input !== "object" || input === null || !("csrfToken" in input) || typeof input.csrfToken !== "string") {
    throw new FirebaseAuthUiError("unknown");
  }
  return input.csrfToken;
}

async function shouldUseStagingPhoneTestMode(auth: Auth, linkUser: User | undefined): Promise<boolean> {
  if (
    linkUser === undefined
    || window.location.origin !== "https://staging.nanohome.vn"
    || auth.app.options.projectId !== "temp-nanohome"
  ) {
    return false;
  }

  const tokenResult = await linkUser.getIdTokenResult();
  return isFirebasePhoneTestModeAllowed({
    origin: window.location.origin,
    projectId: auth.app.options.projectId,
    stagingTestClaim: tokenResult.claims.stagingTest,
  });
}

export function createFirebaseBrowserAuthPort(): FirebaseBrowserAuthPort {
  let recaptchaVerifier: RecaptchaVerifier | null = null;

  const clearPhoneVerifier = () => {
    recaptchaVerifier?.clear();
    recaptchaVerifier = null;
  };

  return {
    clearPhoneVerifier,
    async requestPhoneCode(phone, recaptchaContainerId, linkUser) {
      try {
        const auth = await getFirebaseBrowserAuth();
        const previousAppVerificationSetting = auth.settings.appVerificationDisabledForTesting;
        const useStagingPhoneTestMode = await shouldUseStagingPhoneTestMode(auth, linkUser);
        if (useStagingPhoneTestMode) {
          auth.settings.appVerificationDisabledForTesting = true;
        }
        clearPhoneVerifier();
        let confirmation: ConfirmationResult;
        try {
          recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
          confirmation = linkUser === undefined
            ? await signInWithPhoneNumber(auth, phone, recaptchaVerifier)
            : await linkWithPhoneNumber(linkUser, phone, recaptchaVerifier);
        } finally {
          auth.settings.appVerificationDisabledForTesting = previousAppVerificationSetting;
        }
        return {
          confirm: async (code) => {
            try {
              return (await confirmation.confirm(code)).user;
            } catch (error) {
              throw mapFirebaseError(error);
            }
          },
        };
      } catch (error) {
        clearPhoneVerifier();
        if (error instanceof FirebaseAuthUiError) throw error;
        throw mapFirebaseError(error);
      }
    },
    async signInGoogle() {
      try {
        const auth = await getFirebaseBrowserAuth();
        auth.languageCode = document.documentElement.lang || "vi";
        return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
      } catch (error) {
        throw mapFirebaseError(error);
      }
    },
    async startGoogleRedirect() {
      try {
        const auth = await getFirebaseBrowserAuth();
        await setPersistence(auth, browserSessionPersistence);
        auth.languageCode = document.documentElement.lang || "vi";
        window.sessionStorage.setItem(GOOGLE_REDIRECT_MARKER, "1");
        await signInWithRedirect(auth, new GoogleAuthProvider());
      } catch (error) {
        window.sessionStorage.removeItem(GOOGLE_REDIRECT_MARKER);
        throw mapFirebaseError(error);
      }
    },
    async consumeGoogleRedirect() {
      if (window.sessionStorage.getItem(GOOGLE_REDIRECT_MARKER) !== "1") return null;
      try {
        const auth = await getFirebaseBrowserAuth();
        const user = (await getRedirectResult(auth))?.user ?? null;
        window.sessionStorage.removeItem(GOOGLE_REDIRECT_MARKER);
        return user;
      } catch (error) {
        window.sessionStorage.removeItem(GOOGLE_REDIRECT_MARKER);
        throw mapFirebaseError(error);
      }
    },
    async signInPassword(email, password) {
      try {
        const auth = await getFirebaseBrowserAuth();
        const user = (await signInWithEmailAndPassword(auth, email, password)).user;
        if (!user.emailVerified) {
          await signOut(auth);
          throw new FirebaseAuthUiError("unverified_email");
        }
        return user;
      } catch (error) {
        if (error instanceof FirebaseAuthUiError) throw error;
        throw mapFirebaseError(error);
      }
    },
    async sendPasswordReset(email, locale) {
      try {
        const auth = await getFirebaseBrowserAuth();
        auth.languageCode = locale;
        // Keep Firebase's hosted email-action fallback until a custom handler is
        // explicitly enabled and verified in the sandbox project.
        await sendPasswordResetEmail(auth, email);
      } catch (error) {
        throw mapFirebaseError(error);
      }
    },
    async verifyEmailBeforeUpdate(user, email, locale, returnTo) {
      try {
        await verifyBeforeUpdateEmail(user, email, {
          handleCodeInApp: false,
          url: `${window.location.origin}/${locale}/auth/email-link?returnTo=${encodeURIComponent(returnTo)}`,
        });
      } catch (error) {
        throw mapFirebaseError(error);
      }
    },
    async reloadUser(user) {
      try {
        await user.reload();
        return user;
      } catch (error) {
        throw mapFirebaseError(error);
      }
    },
    async createServerSession(user, locale, returnTo, intent = "account") {
      const auth = await getFirebaseBrowserAuth();
      try {
        const csrfResponse = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          method: "GET",
        });
        if (!csrfResponse.ok) throw new FirebaseAuthUiError("unknown");
        const csrfToken = parseCsrfResponse(await csrfResponse.json());
        const idToken = await user.getIdToken();
        const sessionResponse = await fetch("/api/auth/session", {
          body: JSON.stringify({ csrfToken, idToken, intent, locale, returnTo }),
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (sessionResponse.status === 403) throw new FirebaseAuthUiError("unverified_email");
        if (!sessionResponse.ok) throw new FirebaseAuthUiError("unknown");
        return parseSessionResponse(await sessionResponse.json());
      } finally {
        await signOut(auth);
      }
    },
  };
}

let browserAuthPort: FirebaseBrowserAuthPort | null = null;

export function getFirebaseBrowserAuthPort(): FirebaseBrowserAuthPort {
  browserAuthPort ??= createFirebaseBrowserAuthPort();
  return browserAuthPort;
}
