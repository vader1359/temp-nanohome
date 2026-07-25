import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountAuthFlow } from "./account-auth-flow";

describe("AccountAuthFlow", () => {
  it("offers all five methods and completes password sign-in through the private API", async () => {
    // Given: a private Account flow endpoint that completes the selected method.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ kind: "completed", returnTo: "/vi/products" }), { status: 200 }));
    render(<AccountAuthFlow locale="vi" returnTo="/vi/products" />);

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

  it("keeps the user in a recoverable phone verification state after an invalid OTP", async () => {
    // Given: phone authentication first requires an OTP and then rejects it generically.
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ kind: "verification_required", method: "phone_otp", returnTo: "/vi" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ kind: "retryable_error" }), { status: 200 }));
    render(<AccountAuthFlow locale="vi" returnTo="/vi" />);

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
    render(<AccountAuthFlow locale="vi" returnTo="/vi" />);

    // When: the visitor starts the default magic-link method.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Then: the malformed boundary response becomes the generic recovery state.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We could not complete sign-in"));
    vi.restoreAllMocks();
  });
});
