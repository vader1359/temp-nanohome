import "server-only";

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

export type FirebaseAdminEnvironment = Readonly<{
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
}>;

export function createFirebaseAdminAuth(environment: FirebaseAdminEnvironment): Auth {
  const existing = getApps()[0];
  const app = existing ?? initializeFirebaseAdmin(environment);
  return getAuth(app);
}

function initializeFirebaseAdmin(environment: FirebaseAdminEnvironment): App {
  const credentialsPresent = environment.clientEmail !== undefined && environment.privateKey !== undefined;
  const credential = credentialsPresent
    ? cert({
      projectId: environment.projectId,
      clientEmail: environment.clientEmail,
      privateKey: environment.privateKey.replaceAll("\\n", "\n"),
    })
    : applicationDefault();

  return initializeApp({ credential, projectId: environment.projectId });
}
