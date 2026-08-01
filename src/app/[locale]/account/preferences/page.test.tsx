import { describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), getPreferences: vi.fn() }));
const redirect = vi.hoisted(() => vi.fn((target: string) => { throw new Error(`NEXT_REDIRECT:${target}`); }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountPreferencesPort: () => ({ getPreferences: ports.getPreferences }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import AccountPreferencesPage, { dynamic } from "./page";

describe("AccountPreferencesPage", () => {
  it("redirects anonymous access without reading preferences", async () => {
    // Given: no authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    await expect(AccountPreferencesPage({ params: Promise.resolve({ locale: "vi" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/vi/account/sign-in");
    expect(dynamic).toBe("force-dynamic");
    expect(ports.getPreferences).not.toHaveBeenCalled();
  });
});
