import "server-only";

export {
  claimPrecreatedCustomer as resolveCustomerAccountClaim,
  createCustomerPrecreationRepository,
  getCustomerAccountIdentityAssurance as resolveCustomerCheckoutAssurance,
  type CustomerPrecreationAccessGate,
  type CustomerPrecreationRepositoryOptions,
  type CustomerClaimResult,
  type CustomerIdentityAssurance,
  type CustomerIdentityAssuranceResult,
  type CustomerPrecreationRepository,
  type VerifiedCustomerClaimInput,
} from "@/lib/amis/customer-precreation.server";
