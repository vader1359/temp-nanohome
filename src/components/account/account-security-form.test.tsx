import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccountSecurity } from "@/lib/account/security-schema";

import { AccountSecurityForm } from "./account-security-form";

const security: AccountSecurity = {
  identities: [{ maskedIdentifier: "m***@example.com", provider: "email", verified: true }],
  sessionCount: 2,
};

describe("AccountSecurityForm", () => {
  it("announces recent authentication when all sessions cannot be revoked", async () => {
    // Given: a protected all-session action.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: "recent_authentication_required" }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AccountSecurityForm security={security} />);

    // When: the user confirms revoking all sessions.
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất tất cả phiên" }));

    // Then: a recovery alert is shown without changing the displayed session count.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cần xác thực lại"));
    expect(screen.getByText("Số phiên hiện có: 2")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/account/security/revoke-all", { method: "POST" });
  });

  it("does not send deletion confirmation until DELETE is exact", () => {
    // Given: the protected deletion confirmation field.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AccountSecurityForm security={security} />);

    // When: a lowercase confirmation is entered.
    fireEvent.change(screen.getByLabelText("Xác nhận xóa"), { target: { value: "delete" } });

    // Then: the destructive confirmation remains disabled.
    expect(screen.getByRole("button", { name: "Xác nhận xóa" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
