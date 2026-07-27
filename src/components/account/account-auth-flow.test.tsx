import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { AccountAuthFlow } from "./account-auth-flow";

const authFlowMessages: Record<"authFlow", Record<string, string>> = {
  authFlow: {
    back: "Back",
    chooseAnotherMethod: "Choose another method",
    continue: "Continue",
    continueToDestination: "Continue to your destination",
    description: "Choose a secure way to continue.",
    email: "Email",
    error: "We could not complete sign-in. Try again or choose another method.",
    google: "Google",
    kakao: "Kakao",
    magicLink: "Magic link",
    methodListLabel: "Sign-in methods",
    password: "Password",
    phoneNumber: "Phone number",
    phoneOtp: "Phone OTP",
    signIn: "Sign in",
    signInComplete: "Sign-in complete",
    signInCompleteDescription: "Sign-in complete. Continue when you are ready.",
    tryAgain: "Try again",
    verificationCode: "Verification code",
    verificationDescription: "Enter the verification code to continue.",
    verifyCode: "Verify code",
    verifying: "Verifying…",
    verifySignIn: "Verify your sign-in",
  },
} as const;

function renderAuthFlow(locale = "vi", messages = authFlowMessages) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ Account: messages }}>
      <AccountAuthFlow locale={locale} returnTo={`/${locale}/products`} />
    </NextIntlClientProvider>,
  );
}

describe("AccountAuthFlow", () => {
  it("offers all five methods and completes password sign-in through the private API", async () => {
    // Given: a private Account flow endpoint that completes the selected method.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ kind: "completed", returnTo: "/vi/products" }), { status: 200 }));
    renderAuthFlow();

    // When: the visitor selects password and submits the form.
    fireEvent.click(screen.getByRole("button", { name: "Password" }));
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Then: all alternatives remain visible and the completion is announced.
    expect(screen.getByRole("button", { name: "Magic link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kakao" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phone OTP" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sign-in complete"));
    expect(screen.getByRole("link", { name: "Continue to your destination" })).toHaveAttribute("href", "/vi/products");
    vi.restoreAllMocks();
  });

  it("renders controls from localized Account messages", () => {
    // Given: Korean Account messages supplied through the client provider.
    const koreanMessages = {
      ...authFlowMessages,
      authFlow: { ...authFlowMessages.authFlow, signIn: "로그인", continue: "계속" },
    };
    renderAuthFlow("ko", koreanMessages);

    // When: the sign-in flow first renders.
    // Then: its visible controls use the active locale.
    expect(screen.getByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계속" })).toBeInTheDocument();
  });

  it("keeps the user in a recoverable phone verification state after an invalid OTP", async () => {
    // Given: phone authentication first requires an OTP and then rejects it generically.
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ kind: "verification_required", method: "phone_otp", returnTo: "/vi" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ kind: "retryable_error" }), { status: 200 }));
    renderAuthFlow();

    // When: the visitor requests a phone code and submits an invalid one.
    fireEvent.click(screen.getByRole("button", { name: "Phone OTP" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Verification code");
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    // Then: an alert offers retry, back, and a different method without disclosure.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We could not complete sign-in"));
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose another method" })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it("keeps the visitor recoverable when a successful response is malformed", async () => {
    // Given: a private endpoint that returns an invalid successful response.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{", { status: 200 }));
    renderAuthFlow();

    // When: the visitor starts the default magic-link method.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Then: the malformed boundary response becomes the generic recovery state.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We could not complete sign-in"));
    vi.restoreAllMocks();
  });
});
