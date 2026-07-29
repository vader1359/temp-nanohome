import "server-only";

import type { Locale } from "@/i18n/routing";

const FIREBASE_AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1";

type Fetcher = typeof fetch;

type FirebaseAuthRestResponse = Readonly<{
  idToken?: string;
  error?: Readonly<{ message?: string }>;
}>;

export class FirebaseAuthRestError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "FirebaseAuthRestError";
  }
}

export interface FirebaseAuthRestClient {
  readonly signInWithPassword: (email: string, password: string) => Promise<string>;
  readonly signUpAndSendVerification: (email: string, password: string, locale: Locale) => Promise<void>;
  readonly sendPasswordReset: (email: string, locale: Locale) => Promise<void>;
  readonly confirmPasswordReset: (oobCode: string, newPassword: string) => Promise<void>;
}

function firebaseErrorCode(payload: FirebaseAuthRestResponse): string {
  const message = payload.error?.message;
  if (typeof message !== "string" || message === "") return "FIREBASE_AUTH_FAILED";
  return message.split(" : ", 1)[0] ?? "FIREBASE_AUTH_FAILED";
}

export function createFirebaseAuthRestClient(input: Readonly<{
  apiKey: string;
  fetcher?: Fetcher;
}>): FirebaseAuthRestClient {
  const fetcher = input.fetcher ?? fetch;

  const post = async (
    operation: string,
    body: Readonly<Record<string, unknown>>,
    locale?: Locale,
  ): Promise<FirebaseAuthRestResponse> => {
    let response: Response;
    try {
      response = await fetcher(`${FIREBASE_AUTH_BASE_URL}/accounts:${operation}?key=${encodeURIComponent(input.apiKey)}`, {
        body: JSON.stringify(body),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(locale === undefined ? {} : { "X-Firebase-Locale": locale }),
        },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new FirebaseAuthRestError("NETWORK_ERROR");
    }

    const payload = await response.json().catch(() => ({})) as FirebaseAuthRestResponse;
    if (!response.ok) throw new FirebaseAuthRestError(firebaseErrorCode(payload));
    return payload;
  };

  return {
    async signInWithPassword(email, password) {
      const payload = await post("signInWithPassword", {
        email,
        password,
        returnSecureToken: true,
      });
      if (typeof payload.idToken !== "string" || payload.idToken === "") {
        throw new FirebaseAuthRestError("FIREBASE_AUTH_FAILED");
      }
      return payload.idToken;
    },
    async signUpAndSendVerification(email, password, locale) {
      const created = await post("signUp", {
        email,
        password,
        returnSecureToken: true,
      }, locale);
      if (typeof created.idToken !== "string" || created.idToken === "") {
        throw new FirebaseAuthRestError("FIREBASE_AUTH_FAILED");
      }
      await post("sendOobCode", {
        idToken: created.idToken,
        requestType: "VERIFY_EMAIL",
      }, locale);
    },
    async sendPasswordReset(email, locale) {
      await post("sendOobCode", {
        email,
        requestType: "PASSWORD_RESET",
      }, locale);
    },
    async confirmPasswordReset(oobCode, newPassword) {
      await post("resetPassword", { newPassword, oobCode });
    },
  };
}
