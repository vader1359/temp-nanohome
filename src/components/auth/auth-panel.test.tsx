import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const authContext = vi.hoisted(() => ({
  authError: null as string | null,
  closeAuth: vi.fn(),
  isOpen: true,
  switchAuthView: vi.fn(),
  view: "login" as "login" | "register" | "forgot" | "register_success" | "forgot_sent",
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("./auth-provider", () => ({
  useAuthContext: () => authContext,
}));

vi.mock("./login-form", () => ({
  LoginForm: () => <button type="button">login action</button>,
}));

vi.mock("./register-form", () => ({
  RegisterForm: () => <button type="button">register action</button>,
}));

vi.mock("./forgot-password-form", () => ({
  ForgotPasswordForm: () => <button type="button">forgot action</button>,
}));

vi.mock("./success-view", () => ({
  SuccessView: () => <button type="button">success action</button>,
}));

import { AuthPanel } from "./auth-panel";

describe("AuthPanel", () => {
  it("focuses and names the active dialog view while containing keyboard navigation", () => {
    // Given: the login panel is opened from an account trigger.
    authContext.isOpen = true;
    authContext.view = "login";
    render(<AuthPanel redirectTo="/vi" />);

    // When: the panel settles after opening and the close control receives Shift+Tab.
    const dialog = screen.getByRole("dialog", { name: "login.title" });
    const closeButton = screen.getByRole("button", { name: "common.close" });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });

    // Then: focus stays inside the dialog and reaches the final interactive control.
    expect(document.activeElement instanceof HTMLElement && dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole("button", { name: "login action" })).toHaveFocus();
    expect(closeButton).toHaveClass("size-11");
  });

  it("removes its closed controls from keyboard navigation", () => {
    // Given: the auth panel is closed.
    authContext.isOpen = false;
    const { container } = render(<AuthPanel redirectTo="/vi" />);

    // When: the overlay remains mounted for its exit transition.
    const overlay = container.firstElementChild;

    // Then: closed controls cannot be reached by keyboard navigation.
    expect(overlay).toHaveAttribute("inert");
  });

  it("uses the active view title as the dialog name", () => {
    // Given: the registration success state is active.
    authContext.isOpen = true;
    authContext.view = "register_success";
    render(<AuthPanel redirectTo="/vi" />);

    // When: assistive technology reads the dialog.
    const dialog = screen.getByRole("dialog", { name: "register.successTitle" });

    // Then: the dialog announces its current content rather than the login title.
    expect(dialog).toBeInTheDocument();
  });

  it("locks both document scroll containers while the dialog is open", () => {
    // Given: the page can scroll before the auth dialog opens.
    authContext.isOpen = true;
    authContext.view = "login";
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";

    // When: the auth dialog is rendered.
    render(<AuthPanel redirectTo="/vi" />);

    // Then: neither the body nor root document can scroll behind the dialog.
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("restores focus to the replacement account trigger after URL-driven close", async () => {
    // Given: the original account trigger is replaced after the auth query is removed.
    const originalTrigger = document.createElement("button");
    originalTrigger.setAttribute("data-auth-trigger", "");
    document.body.append(originalTrigger);
    originalTrigger.focus();
    authContext.isOpen = true;
    const { rerender } = render(<AuthPanel redirectTo="/vi" />);
    originalTrigger.remove();
    const replacementTrigger = document.createElement("button");
    replacementTrigger.setAttribute("data-auth-trigger", "");
    document.body.append(replacementTrigger);

    // When: the auth panel closes after the route state update.
    authContext.isOpen = false;
    rerender(<AuthPanel redirectTo="/en" />);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    // Then: keyboard focus returns to the replacement account control.
    expect(replacementTrigger).toHaveFocus();
  });
});
