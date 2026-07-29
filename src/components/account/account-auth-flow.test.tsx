import type { User } from "firebase/auth";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import {
  FirebaseAuthUiError,
  type FirebaseBrowserAuthPort,
  type FirebasePhoneConfirmation,
} from "@/lib/auth/firebase-browser-auth";
import { AccountAuthFlow } from "./account-auth-flow";

const firebaseUser = { getIdToken: vi.fn() } as unknown as User;

function createAuthPort() {
  const confirmation: FirebasePhoneConfirmation = {
    confirm: vi.fn(async () => firebaseUser),
  };
  const port: FirebaseBrowserAuthPort = {
    clearPhoneVerifier: vi.fn(),
    consumeGoogleRedirect: vi.fn(async () => null),
    createServerSession: vi.fn(async () => "/en/products"),
    requestPhoneCode: vi.fn(async () => confirmation),
    sendPasswordReset: vi.fn(async () => undefined),
    signInGoogle: vi.fn(async () => firebaseUser),
    signInPassword: vi.fn(async () => firebaseUser),
    startGoogleRedirect: vi.fn(async () => undefined),
  };
  return { confirmation, port };
}

function renderAuthFlow(port: FirebaseBrowserAuthPort, navigate = vi.fn()) {
  return {
    navigate,
    ...render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AccountAuthFlow
          authPort={port}
          locale="en"
          navigate={navigate}
          returnTo="/en/products?auth=login"
        />
      </NextIntlClientProvider>,
    ),
  };
}

describe("AccountAuthFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Phone OTP as primary with Google and email alternatives, but no Kakao or magic link", () => {
    const { port } = createAuthPort();
    renderAuthFlow(port);

    expect(screen.getByRole("button", { name: "Phone" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Email" })).toBeInTheDocument();
    expect(screen.queryByText(/Kakao/iu)).not.toBeInTheDocument();
    expect(screen.queryByText(/Magic link/iu)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toHaveAttribute("autocomplete", "tel");
  });

  it("normalizes a Vietnamese phone, keeps OTP in memory, and exchanges only the Firebase user", async () => {
    const { confirmation, port } = createAuthPort();
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const { navigate } = renderAuthFlow(port);

    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "090 123 4567" } });
    fireEvent.click(screen.getByRole("button", { name: "Get OTP" }));

    const otpInput = await screen.findByLabelText("Six-digit OTP");
    expect(port.requestPhoneCode).toHaveBeenCalledWith("+84901234567", "nanohome-phone-recaptcha");
    fireEvent.change(otpInput, { target: { value: "12a3456" } });
    expect(otpInput).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/en/products"));
    expect(confirmation.confirm).toHaveBeenCalledWith("123456");
    expect(port.createServerSession).toHaveBeenCalledWith(firebaseUser, "en", "/en/products?auth=login");
    expect(storageSpy).not.toHaveBeenCalled();
    storageSpy.mockRestore();
  });

  it("shows a safe recoverable error for invalid OTP and supports changing phone", async () => {
    const { confirmation, port } = createAuthPort();
    vi.mocked(confirmation.confirm).mockRejectedValueOnce(new FirebaseAuthUiError("invalid_code"));
    renderAuthFlow(port);

    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0901234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Get OTP" }));
    const otpInput = await screen.findByLabelText("Six-digit OTP");
    fireEvent.change(otpInput, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid six-digit OTP"));
    expect(screen.getByRole("button", { name: /Resend in 60s/u })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Change phone" }));
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(port.clearPhoneVerifier).toHaveBeenCalled();
  });

  it("completes Google sign-in through the provider and server-session boundary", async () => {
    const { port } = createAuthPort();
    renderAuthFlow(port);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(port.startGoogleRedirect).toHaveBeenCalledOnce());
    expect(port.signInGoogle).not.toHaveBeenCalled();
  });

  it("supports verified email/password, password visibility, and hosted reset fallback", async () => {
    const { port } = createAuthPort();
    renderAuthFlow(port);

    fireEvent.click(screen.getByRole("button", { name: "Email" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));
    await waitFor(() => expect(port.signInPassword).toHaveBeenCalledWith("person@example.test", "correct horse"));

    fireEvent.click(screen.getByRole("button", { name: "Forgot password" }));
    await waitFor(() => expect(port.sendPasswordReset).toHaveBeenCalledWith("person@example.test", "en"));
    expect(screen.getByRole("status")).toHaveTextContent("secure password-reset instructions");
  });
});
