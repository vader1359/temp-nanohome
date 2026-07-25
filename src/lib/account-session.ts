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

export class AccountSession {
  readonly accountId: AccountId;
  readonly externalSubject: ExternalPrincipalSubject;

  constructor(accountId: AccountId, externalSubject: ExternalPrincipalSubject) {
    this.accountId = accountId;
    this.externalSubject = externalSubject;
  }
}

export interface AccountSessionVerifier {
  verify(sessionCookie: ServerSessionCookie): Promise<AccountSession | null>;
}
