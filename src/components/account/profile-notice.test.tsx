import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProfileNotice, type ProfileNoticeProfile } from "./profile-notice";

const completeProfile: ProfileNoticeProfile = {
  fullName: "An Nguyễn",
  dateOfBirth: "1990-01-01",
  nationality: "Việt Nam",
  formOfAddress: "Anh",
  locale: "vi",
  primaryEmail: "an@example.com",
  primaryPhone: "+84901234567",
  providerMetadata: [],
};

describe("ProfileNotice", () => {
  it("shows unverified provider metadata without treating it as a primary contact", () => {
    // Given: a profile with an unverified provider identity and a verified email.
    render(
      <ProfileNotice
        profile={{
          ...completeProfile,
          providerMetadata: [{ provider: "google", identifier: "an@gmail.com" }],
        }}
      />,
    );

    // When: the profile notices are displayed.
    // Then: provider information is explicit and the verified primary contact remains distinct.
    expect(screen.getByRole("note", { name: "Thông tin nhà cung cấp chưa xác minh" })).toHaveTextContent("google");
    expect(screen.getByRole("note", { name: "Thông tin nhà cung cấp chưa xác minh" })).toHaveTextContent("an@gmail.com");
    expect(screen.getByRole("note", { name: "Thông tin nhà cung cấp chưa xác minh" })).toHaveTextContent("Chưa xác minh");
    expect(screen.queryByLabelText("Email chính", { selector: "input" })).not.toBeInTheDocument();
  });

  it("shows missing recommended optional fields", () => {
    // Given: a profile with only its verified contacts.
    render(
      <ProfileNotice
        profile={{
          ...completeProfile,
          fullName: null,
          nationality: null,
          formOfAddress: null,
          locale: null,
        }}
      />,
    );

    // When: the profile notices are displayed.
    // Then: the missing-field notice names the optional fields to complete.
    expect(screen.getByRole("note", { name: "Thông tin hồ sơ được đề xuất" })).toHaveTextContent("Họ và tên");
    expect(screen.getByRole("note", { name: "Thông tin hồ sơ được đề xuất" })).toHaveTextContent("Quốc tịch");
    expect(screen.getByRole("note", { name: "Thông tin hồ sơ được đề xuất" })).toHaveTextContent("Xưng hô");
    expect(screen.getByRole("note", { name: "Thông tin hồ sơ được đề xuất" })).toHaveTextContent("Ngôn ngữ");
  });

  it("preserves the phone-only message", () => {
    // Given: a profile with no verified email and no provider metadata.
    render(<ProfileNotice profile={{ ...completeProfile, primaryEmail: null }} />);

    // When: the profile notices are displayed.
    // Then: the existing phone-only message remains available.
    expect(screen.getByText("Chỉ có số điện thoại đã xác minh.")).toBeInTheDocument();
  });
});
