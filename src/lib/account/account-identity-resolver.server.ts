import "server-only";

import type {
  CustomerClaimResult,
  VerifiedCustomerClaimInput,
} from "@/lib/amis/customer-claim.server";
import { lookupDigest } from "@/lib/amis/customer-precreation";

import type {
  AccountIdentityRepositoryInput,
  AccountIdentityResolution,
  AccountIdentityResolver,
  FirebaseIdentityResolutionInput,
} from "./identity-resolution";

type AccountIdentityRepository = Readonly<{
  readonly resolveOrCreateAccount: (
    input: AccountIdentityRepositoryInput,
  ) => Promise<AccountIdentityResolution>;
}>;

type CustomerClaimResolver = (
  claim: VerifiedCustomerClaimInput,
) => Promise<CustomerClaimResult>;

export class AccountIdentityResolutionError extends Error {
  constructor(
    readonly code:
      | "crm_conflict"
      | "crm_unavailable"
      | "identity_incomplete"
      | "request_failed",
  ) {
    super(code);
    this.name = "AccountIdentityResolutionError";
  }
}

export function createAccountIdentityResolver(input: Readonly<{
  readonly lookupSecret: string;
  readonly repository: AccountIdentityRepository;
  readonly resolveCustomerClaim: CustomerClaimResolver;
}>): AccountIdentityResolver {
  return {
    async resolveOrCreate(identity) {
      assertIdentityCompleteness(identity);

      let claimResult: CustomerClaimResult;
      try {
        claimResult = await input.resolveCustomerClaim(toVerifiedClaim(identity));
      } catch {
        throw new AccountIdentityResolutionError("crm_unavailable");
      }

      if (claimResult.status === "conflict") {
        throw new AccountIdentityResolutionError("crm_conflict");
      }
      if (
        claimResult.status === "claimed"
        || claimResult.status === "already_claimed"
      ) {
        if (claimResult.accountId === null || claimResult.assurance === null) {
          throw new AccountIdentityResolutionError("request_failed");
        }
        if (identity.intent === "checkout" && !claimResult.assurance.checkoutReady) {
          throw new AccountIdentityResolutionError("identity_incomplete");
        }
        return {
          accountId: claimResult.accountId,
          outcome: claimResult.status === "claimed"
            ? "crm_claimed"
            : "existing_principal",
        };
      }

      const emailDigest = identity.email === null
        ? null
        : lookupDigest(input.lookupSecret, "email", identity.email);
      const phoneDigest = identity.phoneE164 === null
        ? null
        : lookupDigest(input.lookupSecret, "phone", identity.phoneE164);
      return input.repository.resolveOrCreateAccount({
        emailDigest,
        firebaseUid: identity.firebaseUid,
        idempotencyKey: identity.idempotencyKey,
        phoneDigest,
        policyVersions: {
          identity: "identity-v2",
          lookup: "hmac-sha256-nul-v1",
          phone: "e164-v1",
        },
      });
    },
  };
}

function assertIdentityCompleteness(identity: FirebaseIdentityResolutionInput): void {
  if (
    (identity.email === null && identity.phoneE164 === null)
    || (
      identity.intent === "checkout"
      && (identity.email === null || identity.phoneE164 === null)
    )
  ) {
    throw new AccountIdentityResolutionError("identity_incomplete");
  }
}

function toVerifiedClaim(
  identity: FirebaseIdentityResolutionInput,
): VerifiedCustomerClaimInput {
  if (identity.email !== null && identity.phoneE164 !== null) {
    return {
      emailVerified: true,
      firebaseUid: identity.firebaseUid,
      phoneVerified: true,
      verifiedEmail: identity.email,
      verifiedPhoneE164: identity.phoneE164,
    };
  }
  if (identity.phoneE164 !== null) {
    return {
      emailVerified: false,
      firebaseUid: identity.firebaseUid,
      phoneVerified: true,
      verifiedPhoneE164: identity.phoneE164,
    };
  }
  if (identity.email !== null) {
    return {
      emailVerified: true,
      firebaseUid: identity.firebaseUid,
      phoneVerified: false,
      verifiedEmail: identity.email,
    };
  }
  throw new AccountIdentityResolutionError("identity_incomplete");
}
