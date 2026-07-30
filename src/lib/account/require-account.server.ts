import "server-only";

import { redirect } from "next/navigation";

import type { AuthenticatedAccount } from "./auth-port";
import { getAccountAuthPort } from "./account-ports.server";

type RequireAuthenticatedAccountOptions = Readonly<{
  readonly requireCheckoutIdentity?: boolean;
}>;

function hasVerifiedCheckoutIdentity(account: AuthenticatedAccount): boolean {
  return account.identities.some((identity) => identity.provider === "email" && identity.verified)
    && account.identities.some((identity) => identity.provider === "phone" && identity.verified);
}

export async function requireAuthenticatedAccount(
  locale: string,
  returnTo: string,
  options: RequireAuthenticatedAccountOptions = {},
): Promise<AuthenticatedAccount> {
  const account = await getAccountAuthPort().getAuthenticatedAccount();
  if (account !== null && (!options.requireCheckoutIdentity || hasVerifiedCheckoutIdentity(account))) return account;

  const intent = options.requireCheckoutIdentity ? "&intent=checkout" : "";
  redirect(`/${locale}/account/sign-in?returnTo=${encodeURIComponent(returnTo)}${intent}`);
}
