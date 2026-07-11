import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

interface HoistedState {
  isAuthenticated: boolean | undefined;
  session: { user: { id: string } } | null;
  toasterMobileOffset: string | undefined;
  toasterOffset: string | undefined;
  toasterPosition: string | undefined;
}

// Hoist auth parameter storage to capture AuthProvider props
const hoisted = vi.hoisted<HoistedState>(() => ({
  isAuthenticated: undefined,
  session: null,
  toasterMobileOffset: undefined,
  toasterOffset: undefined,
  toasterPosition: undefined,
}));

// Mock routing configurations
vi.mock("@/i18n/routing", () => ({
  isSupportedLocale: (locale: string) => locale === "vi" || locale === "en",
  routing: {
    locales: ["vi", "en"],
  },
}));

// Mock next-intl server capabilities
vi.mock("next-intl/server", () => ({
  getMessages: async () => ({}),
  setRequestLocale: vi.fn(),
}));

// Mock next-intl client capabilities
vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: ({
    mobileOffset,
    offset,
    position,
  }: {
    mobileOffset?: string;
    offset?: string;
    position?: string;
  }) => {
    hoisted.toasterMobileOffset = mobileOffset;
    hoisted.toasterOffset = offset;
    hoisted.toasterPosition = position;
    return <div data-testid="toaster" />;
  },
}));

// Mock AuthProvider and capture its input properties
vi.mock("@/components/auth/auth-provider", () => ({
  AuthProvider: ({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) => {
    hoisted.isAuthenticated = isAuthenticated;
    return <div data-testid="auth-provider">{children}</div>;
  },
  useAuthContext: () => ({
    isAuthenticated: hoisted.isAuthenticated,
    openAuth: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound called");
  },
}));

// Mock layout global containers
vi.mock("../providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <div data-testid="providers">{children}</div>,
}));

vi.mock("@/components/header", () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock("@/components/sections/footer", () => ({
  Footer: () => <div data-testid="footer" />,
}));

// Mock Supabase Server Client setup
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: hoisted.session,
        },
        error: null,
      }),
    },
  }),
}));

describe("RootLayout auth bootstrap", () => {
  it("authenticates the UI when a non-null session exists", async () => {
    // Given: Supabase server client returns a non-null session
    hoisted.session = { user: { id: "user-123" } };
    hoisted.isAuthenticated = undefined;

    // When: the layout is rendered with supported parameters
    const params = Promise.resolve({ locale: "vi" });
    const rendered = await RootLayout({
      children: <div data-testid="child" />,
      params,
    });

    render(rendered);

    // Then: the captured AuthProvider reports isAuthenticated as true
    expect(screen.getByTestId("auth-provider")).toBeInTheDocument();
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
    expect(hoisted.toasterPosition).toBe("top-center");
    expect(hoisted.toasterOffset).toBe("168px");
    expect(hoisted.toasterMobileOffset).toBe("96px");
    expect(hoisted.isAuthenticated).toBe(true);
  });

  it("leaves the UI unauthenticated when no session exists", async () => {
    // Given: Supabase server client returns a null session
    hoisted.session = null;
    hoisted.isAuthenticated = undefined;

    // When: the layout is rendered with supported parameters
    const params = Promise.resolve({ locale: "vi" });
    const rendered = await RootLayout({
      children: <div data-testid="child" />,
      params,
    });

    render(rendered);

    // Then: the captured AuthProvider reports isAuthenticated as false
    expect(screen.getByTestId("auth-provider")).toBeInTheDocument();
    expect(hoisted.isAuthenticated).toBe(false);
  });
});
