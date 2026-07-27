import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountProfileForm, type ClientProfile } from "./account-profile-form";

const profile: ClientProfile = {
  fullName: "An Nguyễn",
  dateOfBirth: null,
  nationality: "Việt Nam",
  formOfAddress: null,
  locale: "vi",
  primaryEmail: null,
  primaryPhone: "+84901234567",
};

describe("AccountProfileForm", () => {
  it("renders verified contacts, editable fields, and phone-only notice", () => {
    // Given: a verified phone-only profile.
    render(<AccountProfileForm profile={profile} />);

    // When: the profile form is displayed.
    // Then: contacts are read-only and editable controls are labelled.
    expect(screen.getByText("Chỉ có số điện thoại đã xác minh.")).toBeInTheDocument();
    expect(screen.getByLabelText("Số điện thoại đã xác minh")).toHaveValue("+84901234567");
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("An Nguyễn");
    expect(screen.getByLabelText("Ngày sinh")).toBeInTheDocument();
    expect(screen.getByLabelText("Email đã xác minh")).toHaveAttribute("readonly");
  });

  it("submits only changed editable fields", async () => {
    // Given: an unchanged profile and a private API request spy.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(profile), { status: 200 }),
    );
    render(<AccountProfileForm profile={profile} />);

    // When: the user changes only the name.
    fireEvent.change(screen.getByLabelText("Họ và tên"), { target: { value: "Bình Nguyễn" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    // Then: the request contains only the changed field.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ fullName: "Bình Nguyễn" }),
    });
    fetchSpy.mockRestore();
  });

  it("preserves input and exposes field errors on 422", async () => {
    // Given: a private API that rejects the submitted date.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ fieldErrors: { dateOfBirth: "Ngày sinh không hợp lệ." } }), { status: 422 }),
    );
    render(<AccountProfileForm profile={profile} />);

    // When: the user submits an invalid date.
    const date = screen.getByLabelText("Ngày sinh");
    fireEvent.change(date, { target: { value: "2020-02-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    // Then: the entered value remains and the error is announced.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ngày sinh không hợp lệ."));
    expect(date).toHaveValue("2020-02-31");
    vi.restoreAllMocks();
  });
});
