import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
  },
}));

import { CheckEmailView } from "./check-email-view";

describe("CheckEmailView", () => {
  it("renders confirmation guidance with a localized login link", () => {
    // Given: a Vietnamese user opens the confirmation route directly.
    render(<CheckEmailView signupCompleted={false} />);

    // When: the confirmation page renders.
    const loginLink = screen.getByRole("link", { name: "common.backToLogin" });

    // Then: it shows confirmation guidance without claiming a successful sign-up.
    expect(screen.getByRole("heading", { name: "checkEmail.title" })).toBeInTheDocument();
    expect(screen.getByText("checkEmail.body")).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/vi?auth=login");
    expect(screen.getByRole("main")).toHaveClass("py-20");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows one success toast after the verified signup redirect arrives", async () => {
    // Given: the route includes the server-owned signup success marker.
    // When: the confirmation page renders after the redirect.
    render(<CheckEmailView signupCompleted />);

    // Then: it announces the email confirmation only after arrival.
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledOnce());
    expect(screen.getByRole("main")).toHaveClass("pt-80");
    expect(toastSuccess).toHaveBeenCalledWith("checkEmail.title", { description: "checkEmail.body" });
  });
});
