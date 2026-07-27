import "server-only";

import {
  AccountId,
  AccountSession,
  ExternalPrincipalSubject,
  type AccountSessionVerifier,
  type ServerSessionCookie,
} from "../account-session";
import { createFirebaseAdminAuth, type FirebaseAdminEnvironment } from "./firebase-admin.server";

export const FIREBASE_SESSION_COOKIE = "__Host-nanohome-session";

export type FirebaseSessionClaims = Readonly<{
  sub: string;
  uid: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}>;

export type AccountIdentityRepository = Readonly<{
  resolveOrProvision: (subject: ExternalPrincipalSubject) => Promise<AccountId | null>;
}>;

type FirebaseVerifierDependencies = Readonly<{
  projectId: string;
  verifySessionCookie: (cookie: string, checkRevoked: boolean) => Promise<FirebaseSessionClaims>;
  accounts: AccountIdentityRepository;
}>;

export function firebaseSessionCookieOptions(maxAge: number): Readonly<{
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}> {
  return { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge };
}

export function createFirebaseAdminSessionVerifier(input: Readonly<{
  environment: FirebaseAdminEnvironment;
  accounts: AccountIdentityRepository;
}>): AccountSessionVerifier {
  const auth = createFirebaseAdminAuth(input.environment);
  return createFirebaseSessionVerifier({
    projectId: input.environment.projectId,
    verifySessionCookie: (cookie, checkRevoked) => auth.verifySessionCookie(cookie, checkRevoked),
    accounts: input.accounts,
  });
}

export function createFirebaseSessionVerifier(
  dependencies: FirebaseVerifierDependencies,
): AccountSessionVerifier {
  return {
    verify: async (sessionCookie: ServerSessionCookie): Promise<AccountSession | null> => {
      if (sessionCookie.value.length === 0) return null;

      try {
        const claims = await dependencies.verifySessionCookie(sessionCookie.value, true);
        const expectedIssuer = `https://session.firebase.google.com/${dependencies.projectId}`;
        const claimsMatch = claims.aud === dependencies.projectId
          && claims.iss === expectedIssuer
          && claims.sub.length > 0
          && claims.sub === claims.uid;
        if (!claimsMatch) return null;

        const externalSubject = new ExternalPrincipalSubject(claims.sub);
        const accountId = await dependencies.accounts.resolveOrProvision(externalSubject);
        if (accountId === null) return null;

        return new AccountSession(accountId, externalSubject, {
          issuer: claims.iss,
          audience: claims.aud,
          issuedAt: claims.iat,
          expiresAt: claims.exp,
        });
      } catch (error) {
        if (error instanceof Error) return null;
        throw error;
      }
    },
  };
}
