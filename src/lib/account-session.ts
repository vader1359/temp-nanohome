import "server-only";

export class AccountId {
  readonly value: string;
  readonly #accountId = true;

  constructor(value: string) {
    this.value = value;
  }
}

export class ExternalPrincipalSubject {
  readonly value: string;
  readonly #externalPrincipalSubject = true;

  constructor(value: string) {
    this.value = value;
  }
}

export class ServerSessionCookie {
  readonly value: string;
  readonly #serverSessionCookie = true;

  constructor(value: string) {
    this.value = value;
  }
}

export type AccountSessionClaims = Readonly<{
  issuer: string;
  audience: string;
  issuedAt: number;
  expiresAt: number;
}>;

export class AccountSession {
  readonly accountId: AccountId;
  readonly externalSubject: ExternalPrincipalSubject;
  readonly claims?: AccountSessionClaims;

  constructor(accountId: AccountId, externalSubject: ExternalPrincipalSubject, claims?: AccountSessionClaims) {
    this.accountId = accountId;
    this.externalSubject = externalSubject;
    this.claims = claims;
  }
}

export interface AccountSessionVerifier {
  verify(sessionCookie: ServerSessionCookie): Promise<AccountSession | null>;
}
