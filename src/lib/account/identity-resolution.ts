export type FirebaseIdentityResolutionInput = Readonly<{
  readonly email: string | null;
  readonly firebaseUid: string;
  readonly idempotencyKey: string;
  readonly intent: "account" | "checkout";
  readonly phoneE164: string | null;
}>;

export type AccountIdentityRepositoryInput = Readonly<{
  readonly emailDigest: string | null;
  readonly firebaseUid: string;
  readonly idempotencyKey: string;
  readonly phoneDigest: string | null;
  readonly policyVersions: Readonly<Record<string, string>>;
}>;

export type AccountIdentityResolution = Readonly<{
  readonly accountId: string;
  readonly outcome: "created" | "crm_claimed" | "existing_principal";
}>;

export interface AccountIdentityResolver {
  readonly resolveOrCreate: (input: FirebaseIdentityResolutionInput) => Promise<AccountIdentityResolution>;
}
