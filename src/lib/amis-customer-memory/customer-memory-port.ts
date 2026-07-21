import { customerMemorySchema } from "../contracts/schemas";
import type { CustomerMemory } from "../contracts/schemas";
import type { CustomerMemoryPort } from "../contracts/ports";

type LinkState = "active" | "suspended" | "revoked";
type SourceState = "active" | "deleted" | "stale";

type FixturePortInput = {
  readonly userId: string;
  readonly linkState: LinkState;
  readonly sourceState: SourceState;
  readonly consent: Readonly<Record<"concierge" | "personalization", boolean>>;
  readonly memory: CustomerMemory;
};

const hasAccess = (input: FixturePortInput, requestedUserId: string, purpose: "concierge" | "personalization"): boolean =>
  input.userId === requestedUserId && input.linkState === "active" && input.sourceState === "active" && input.consent[purpose];

export const createFixtureCustomerMemoryPort = (input: FixturePortInput): CustomerMemoryPort => ({
  getForAuthenticatedCustomer: async ({ userId, purpose }) => {
    if (!hasAccess(input, userId, purpose)) return null;
    return customerMemorySchema.parse(input.memory);
  },
});

export const createDisabledCustomerMemoryPort = (): CustomerMemoryPort => ({
  getForAuthenticatedCustomer: async () => null,
});
