import { describe, expect, it } from "vitest";
import { customerMemoryFixture } from "../contracts/fixtures";
import { createFixtureCustomerMemoryPort, createDisabledCustomerMemoryPort } from "./customer-memory-port";

describe("AMIS customer memory port", () => {
  it("Given an active verified link with consent, When requested for the same user, Then it returns the safe projection", async () => {
    const port = createFixtureCustomerMemoryPort({
      userId: "user-1",
      linkState: "active",
      sourceState: "active",
      consent: { concierge: true, personalization: true },
      memory: customerMemoryFixture,
    });

    await expect(port.getForAuthenticatedCustomer({ userId: "user-1", purpose: "concierge" })).resolves.toEqual(customerMemoryFixture);
  });

  it("Given an inactive link, missing purpose consent, or another user, When requested, Then it returns null", async () => {
    const port = createFixtureCustomerMemoryPort({
      userId: "user-1",
      linkState: "suspended",
      sourceState: "active",
      consent: { concierge: false, personalization: true },
      memory: customerMemoryFixture,
    });

    await expect(port.getForAuthenticatedCustomer({ userId: "user-1", purpose: "concierge" })).resolves.toBeNull();
    await expect(port.getForAuthenticatedCustomer({ userId: "user-1", purpose: "personalization" })).resolves.toBeNull();
    await expect(port.getForAuthenticatedCustomer({ userId: "user-2", purpose: "personalization" })).resolves.toBeNull();
  });

  it("Given the integration is disabled, When requested, Then it never returns AMIS data", async () => {
    const port = createDisabledCustomerMemoryPort();

    await expect(port.getForAuthenticatedCustomer({ userId: "user-1", purpose: "concierge" })).resolves.toBeNull();
  });
});
