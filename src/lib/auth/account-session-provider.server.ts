import "server-only";

import type { AccountSessionVerifier } from "../account-session";

export type AuthProvider = "supabase" | "firebase";

type AccountSessionProviderDependencies = Readonly<{
  authProvider?: string;
  loadFirebase: () => Promise<AccountSessionVerifier>;
}>;

const disabledVerifier: AccountSessionVerifier = {
  verify: async () => null,
};

export function createAccountSessionVerifier(
  dependencies: AccountSessionProviderDependencies,
): AccountSessionVerifier {
  const provider = dependencies.authProvider ?? "supabase";
  if (provider !== "firebase") return disabledVerifier;

  return {
    verify: async (sessionCookie) => {
      const verifier = await dependencies.loadFirebase();
      return verifier.verify(sessionCookie);
    },
  };
}
