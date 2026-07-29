import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/shared/dark-cta-button", () => ({
  DarkCTAButton: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

import { ResetPasswordForm } from "./reset-password-form";

describe("ResetPasswordForm", () => {
  it("submits matching passwords to the recovery endpoint", () => {
    // Given: a valid Firebase email-action code reaches the localized reset page.
    render(<ResetPasswordForm oobCode="bounded-firebase-oob-code" />);

    // When: the user enters matching replacement passwords.
    fireEvent.change(screen.getByLabelText("fields.newPassword"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("fields.confirmPassword"), { target: { value: "new-password" } });

    // Then: the native form targets the protected reset endpoint with its locale.
    expect(screen.getByRole("form")).toHaveAttribute("action", "/auth/reset-password");
    expect(screen.getByDisplayValue("vi")).toHaveAttribute("name", "locale");
    expect(screen.getByDisplayValue("bounded-firebase-oob-code")).toHaveAttribute("name", "oobCode");
  });

  it("keeps the form available when the password submission is invalid", () => {
    // Given: the reset route rejects a password submission.
    render(<ResetPasswordForm oobCode="bounded-firebase-oob-code" status="validation" />);

    // When: the page renders its invalid-submission state.
    const form = screen.getByRole("form");

    // Then: the user can correct the passwords without requesting another recovery email.
    expect(form).toHaveAttribute("action", "/auth/reset-password");
    expect(screen.getByText("errors.resetError")).toBeInTheDocument();
  });

  it("sends expired recovery links back to the forgot-password flow", () => {
    // Given: a recovery callback reaches an expired or invalid link state.
    render(<ResetPasswordForm status="invalid" />);

    // When: the page renders its expired recovery state.
    const resendLink = screen.getByRole("link", { name: "reset.resend" });

    // Then: the user can request a new email instead of submitting an unusable form.
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(resendLink).toHaveAttribute("href", "/vi?auth=forgot");
  });
});
