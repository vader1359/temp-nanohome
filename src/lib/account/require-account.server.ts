import "server-only";

import { redirect } from "next/navigation";

import type { AuthenticatedAccount } from "./auth-port";
import { getAccountAuthPort } from "./account-ports.server";

export async function requireAuthenticatedAccount(
  locale: string,
  returnTo: string,
): Promise<AuthenticatedAccount> {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account !== null) return account;

  redirect(`/${locale}/account/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
}
