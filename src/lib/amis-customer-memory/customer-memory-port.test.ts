import { describe, expect, it } from "vitest";
import { AccountId } from "@/lib/account-session";
import { customerMemoryFixture } from "../contracts/fixtures";
import { createFixtureCustomerMemoryPort, createDisabledCustomerMemoryPort } from "./customer-memory-port";

const accountId = new AccountId("11111111-1111-4111-8111-111111111111");
const otherAccountId = new AccountId("22222222-2222-4222-8222-222222222222");

describe("AMIS customer memory port", () => {
  it("Given an active verified link with consent, When requested for the same account, Then it returns the safe projection", async () => {
    const port = createFixtureCustomerMemoryPort({
      accountId,
      linkState: "active",
      sourceState: "active",
      consent: { concierge: true, personalization: true },
      memory: customerMemoryFixture,
    });

    await expect(port.getForAuthenticatedCustomer({ accountId, purpose: "concierge" })).resolves.toEqual(customerMemoryFixture);
  });

  it("Given an inactive link, missing purpose consent, or another account, When requested, Then it returns null", async () => {
    const port = createFixtureCustomerMemoryPort({
      accountId,
      linkState: "suspended",
      sourceState: "active",
      consent: { concierge: false, personalization: true },
      memory: customerMemoryFixture,
    });

    await expect(port.getForAuthenticatedCustomer({ accountId, purpose: "concierge" })).resolves.toBeNull();
    await expect(port.getForAuthenticatedCustomer({ accountId, purpose: "personalization" })).resolves.toBeNull();
    await expect(port.getForAuthenticatedCustomer({ accountId: otherAccountId, purpose: "personalization" })).resolves.toBeNull();
  });

  it("Given the integration is disabled, When requested, Then it never returns AMIS data", async () => {
    const port = createDisabledCustomerMemoryPort();

    await expect(port.getForAuthenticatedCustomer({ accountId, purpose: "concierge" })).resolves.toBeNull();
  });
});
