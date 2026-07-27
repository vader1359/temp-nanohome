import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountPreferencesForm } from "./account-preferences-form";

const preferences = {
  amisHistory: { available: true, enabled: true },
  browsingHistoryEnabled: true,
  productPersonalizationEnabled: true,
  recommendationDataState: "available",
} as const;

describe("AccountPreferencesForm", () => {
  it("replaces a toggle with the canonical API response", async () => {
    // Given: preferences and a canonical toggle response.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...preferences, browsingHistoryEnabled: false }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AccountPreferencesForm preferences={preferences} />);

    // When: browsing history is disabled.
    fireEvent.click(screen.getByLabelText("Lưu lịch sử duyệt web"));

    // Then: the private patch is sent and the returned state is displayed.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/account/preferences", expect.objectContaining({
      body: JSON.stringify({ browsingHistoryEnabled: false }),
      method: "PATCH",
    }));
    expect(screen.getByLabelText("Lưu lịch sử duyệt web")).not.toBeChecked();
  });

  it("keeps the displayed state and announces reauthentication after a protected action", async () => {
    // Given: an AMIS reset that requires recent authentication.
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: "recent_authentication_required" }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AccountPreferencesForm preferences={preferences} />);

    // When: AMIS history reset is confirmed.
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại lịch sử AMIS" }));

    // Then: the initial AMIS state remains and a neutral alert is announced.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cần xác thực lại"));
    expect(screen.getByText("AMIS history is available")).toBeInTheDocument();
  });

  it("requires confirmation before clearing recommendation data", () => {
    // Given: a user who declines a destructive confirmation.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AccountPreferencesForm preferences={preferences} />);

    // When: recommendation data clearing is requested.
    fireEvent.click(screen.getByRole("button", { name: "Xóa dữ liệu đề xuất" }));

    // Then: the endpoint is not called.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
