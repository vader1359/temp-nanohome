import "server-only";

import type { AuthenticatedAccount, AccountIdentityProvider } from "./auth-port";
import type { AccountSecurity, SecurityAuthAction } from "./security-schema";

type SecurityIdentity = Readonly<{
  readonly identifier: string;
  readonly provider: AccountIdentityProvider;
  readonly verified: true;
}>;

type SecurityActionResult =
  | Readonly<{ readonly kind: "completed"; readonly security: AccountSecurity }>
  | Readonly<{ readonly kind: "confirmation_mismatch" }>
  | Readonly<{ readonly kind: "deleted" }>
  | Readonly<{ readonly kind: "last_usable_method" }>
  | Readonly<{ readonly kind: "recent_authentication_required" }>;

export interface AccountSecurityPort {
  readonly getSecurity: (account: AuthenticatedAccount) => Promise<AccountSecurity>;
  readonly requestAuthAction: (account: AuthenticatedAccount, action: SecurityAuthAction) => Promise<SecurityActionResult>;
  readonly logoutCurrentSession: (account: AuthenticatedAccount) => Promise<SecurityActionResult>;
  readonly revokeAllSessions: (account: AuthenticatedAccount) => Promise<SecurityActionResult>;
  readonly beginDeletion: (account: AuthenticatedAccount) => Promise<SecurityActionResult>;
  readonly confirmDeletion: (account: AuthenticatedAccount, confirmation: string) => Promise<SecurityActionResult>;
}

type FakeSecurityOptions = Readonly<{
  readonly allowsSensitiveActions?: boolean;
  readonly identities?: readonly SecurityIdentity[];
  readonly sessionCount?: number;
}>;

const defaultIdentities = [{ identifier: "mai@example.com", provider: "email", verified: true }] as const;

function maskIdentifier(identity: SecurityIdentity): string {
  if (identity.provider === "email") {
    const [local, domain] = identity.identifier.split("@");
    return `${local?.slice(0, 1) ?? "*"}***@${domain ?? "***"}`;
  }

  return `${identity.identifier.slice(0, 2)}***`;
}

function actionProvider(action: SecurityAuthAction): AccountIdentityProvider {
  switch (action) {
    case "unlink_email": return "email";
    case "unlink_google": return "google";
    case "unlink_phone": return "phone";
  }
}

export function createFakeAccountSecurityPort(options: FakeSecurityOptions = {}): AccountSecurityPort {
  const allowsSensitiveActions = options.allowsSensitiveActions ?? false;
  const identitiesByAccount = new Map<string, readonly SecurityIdentity[]>();
  const sessionsByAccount = new Map<string, number>();
  const deletionStarted = new Set<string>();
  const initialIdentities = options.identities ?? defaultIdentities;
  const initialSessionCount = options.sessionCount ?? 2;

  const identitiesFor = (account: AuthenticatedAccount): readonly SecurityIdentity[] => {
    const existing = identitiesByAccount.get(account.accountId);
    if (existing !== undefined) return existing;
    identitiesByAccount.set(account.accountId, initialIdentities);
    return initialIdentities;
  };
  const sessionsFor = (account: AuthenticatedAccount): number => sessionsByAccount.get(account.accountId) ?? initialSessionCount;
  const securityFor = (account: AuthenticatedAccount): AccountSecurity => ({
    identities: identitiesFor(account).filter((identity) => identity.verified).map((identity) => ({ maskedIdentifier: maskIdentifier(identity), provider: identity.provider, verified: true })),
    sessionCount: sessionsFor(account),
  });
  const requiresRecentAuthentication = (): SecurityActionResult | null => allowsSensitiveActions ? null : { kind: "recent_authentication_required" };

  return {
    async getSecurity(account) { return securityFor(account); },
    async requestAuthAction(account, action) {
      const identities = identitiesFor(account);
      const target = actionProvider(action);
      if (identities.filter((identity) => identity.verified).length <= 1 && identities.some((identity) => identity.provider === target && identity.verified)) return { kind: "last_usable_method" };
      identitiesByAccount.set(account.accountId, identities.filter((identity) => identity.provider !== target));
      return { kind: "completed", security: securityFor(account) };
    },
    async logoutCurrentSession(account) {
      const current = sessionsFor(account);
      sessionsByAccount.set(account.accountId, Math.max(0, current - 1));
      return { kind: "completed", security: securityFor(account) };
    },
    async revokeAllSessions(account) {
      const required = requiresRecentAuthentication();
      if (required !== null) return required;
      sessionsByAccount.set(account.accountId, 0);
      return { kind: "completed", security: securityFor(account) };
    },
    async beginDeletion(account) {
      const required = requiresRecentAuthentication();
      if (required !== null) return required;
      deletionStarted.add(account.accountId);
      return { kind: "completed", security: securityFor(account) };
    },
    async confirmDeletion(account, confirmation) {
      const required = requiresRecentAuthentication();
      if (required !== null) return required;
      if (!deletionStarted.has(account.accountId) || confirmation !== "DELETE") return { kind: "confirmation_mismatch" };
      identitiesByAccount.set(account.accountId, []);
      sessionsByAccount.set(account.accountId, 0);
      deletionStarted.delete(account.accountId);
      return { kind: "deleted" };
    },
  };
}
