import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/shared/dark-cta-button", () => ({
  DarkCTAButton: ({ children }: { readonly children: React.ReactNode }) => <button type="submit">{children}</button>,
}));

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("provides a 44px minimum touch target for password recovery", () => {
    // Given: the login form is rendered inside the mobile auth panel.
    render(<LoginForm onSwitchView={vi.fn()} />);

    // When: a user reaches the password recovery control.
    const forgotPassword = screen.getByRole("button", { name: "login.forgotPassword" });

    // Then: the text action is large enough for touch input.
    expect(forgotPassword).toHaveClass("min-h-11");
  });
});
