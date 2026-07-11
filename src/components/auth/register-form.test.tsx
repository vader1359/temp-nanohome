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

import { RegisterForm } from "./register-form";

describe("RegisterForm", () => {
  it("preserves the native sign-up target, locale, and redirect destination", () => {
    // Given: a registration form opened with a destination after sign-up.
    render(<RegisterForm onSwitchView={vi.fn()} redirectTo="/vi/account" />);

    // When: the native registration form is inspected before submission.
    const form = screen.getByDisplayValue("vi").closest("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Registration form was not rendered");
    }

    // Then: registration posts to the native endpoint with both routing values.
    expect(form).toHaveAttribute("action", "/auth/sign-up");
    expect(form).toHaveAttribute("method", "POST");
    expect(screen.getByDisplayValue("vi")).toHaveAttribute("name", "locale");
    expect(screen.getByDisplayValue("/vi/account")).toHaveAttribute("name", "redirectTo");
  });

  it("shows localized pending feedback after a valid native submission", () => {
    // Given: the user has completed every required registration field.
    render(<RegisterForm onSwitchView={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("fields.fullName"), { target: { value: "Ada Lovelace" } });
    fireEvent.change(screen.getByLabelText("fields.email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("fields.phone"), { target: { value: "+84901234567" } });
    fireEvent.change(screen.getByLabelText("fields.password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("fields.confirmPassword"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "fields.agreeTerms" }));

    // When: the completed form is submitted through its native POST action.
    const form = screen.getByDisplayValue("vi").closest("form");
    expect(form).toBeInstanceOf(HTMLFormElement);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Registration form was not rendered");
    }

    fireEvent.submit(form);

    // Then: the form announces pending state, shows a non-essential indicator, and disables the submit CTA.
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("register.submitting");
    expect(screen.getByTestId("register-submit-indicator")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "register.submitting" })).toBeDisabled();
  });
});
