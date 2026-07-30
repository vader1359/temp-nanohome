"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from "firebase/auth";

let browserAuthPromise: Promise<Auth> | null = null;

function getFirebaseBrowserApp(): FirebaseApp {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };

  if ([config.apiKey, config.authDomain, config.projectId, config.appId].some((value) => !value)) {
    throw new Error("Firebase public configuration is unavailable");
  }

  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function getFirebaseBrowserAuth(): Promise<Auth> {
  browserAuthPromise ??= (async () => {
    const auth = getAuth(getFirebaseBrowserApp());
    // Email verification opens Firebase's hosted action in a new tab. Local
    // Firebase persistence lets that tab observe the same browser user; the
    // application session is still short-lived, HttpOnly, and created only by
    // /api/auth/session.
    await setPersistence(auth, browserLocalPersistence);
    return auth;
  })();
  return browserAuthPromise;
}
