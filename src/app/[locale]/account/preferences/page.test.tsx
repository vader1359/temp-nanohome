import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ getAuthenticatedAccount: vi.fn(), getPreferences: vi.fn() }));
vi.mock("@/lib/account/account-ports.server", () => ({
  getAccountAuthPort: () => ({ getAuthenticatedAccount: ports.getAuthenticatedAccount }),
  getAccountPreferencesPort: () => ({ getPreferences: ports.getPreferences }),
}));

import AccountPreferencesPage, { dynamic } from "./page";

describe("AccountPreferencesPage", () => {
  it("renders an anonymous neutral state without reading preferences", async () => {
    // Given: no authenticated account.
    ports.getAuthenticatedAccount.mockResolvedValue(null);

    // When: the account preferences page is rendered.
    render(await AccountPreferencesPage());

    // Then: it stays dynamic, neutral, and does not query preferences.
    expect(dynamic).toBe("force-dynamic");
    expect(screen.getByText("Tùy chọn tài khoản hiện chưa khả dụng.")).toBeInTheDocument();
    expect(ports.getPreferences).not.toHaveBeenCalled();
  });
});
