"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { getAuthRedirectPath } from "@/lib/auth/redirect";

const AuthPanel = dynamic(
  () => import("./auth-panel").then((module) => module.AuthPanel),
  { ssr: false },
);

export type AuthView = "login" | "register" | "forgot" | "register_success" | "forgot_sent";

interface AuthContextValue {
  isOpen: boolean;
  isAuthenticated: boolean;
  view: AuthView;
  authError: string | null;
  openAuth: (view?: AuthView) => void;
  closeAuth: () => void;
  switchAuthView: (view: AuthView) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children, isAuthenticated }: { children: ReactNode; isAuthenticated: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const authParam = searchParams.get("auth");
  const isOpen = authParam !== null;
  const view: AuthView = authParam === "register" || authParam === "sign_up_error" || authParam === "password_mismatch" || authParam === "terms_required" ? "register"
    : authParam === "forgot" || authParam === "forgot_error" ? "forgot"
    : authParam === "register_success" ? "register_success"
    : authParam === "forgot_sent" ? "forgot_sent"
    : "login";
  const authError = authParam === "sign_in_error" || authParam === "sign_up_error" || authParam === "forgot_error" || authParam === "invalid_credentials" || authParam === "password_mismatch" || authParam === "terms_required" ? authParam : null;
  const redirectTo = getAuthRedirectPath(`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);

  const removeAuthParams = useCallback(() => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.delete("auth");
    const query = newSearchParams.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const updateAuthParam = useCallback((newView: string) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set("auth", newView);
    const query = newSearchParams.toString();
    router.replace(`${pathname}?${query}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openAuth = useCallback((newView: AuthView = "login") => {
    updateAuthParam(newView);
  }, [updateAuthParam]);

  const closeAuth = useCallback(() => {
    removeAuthParams();
  }, [removeAuthParams]);

  const switchAuthView = useCallback((newView: AuthView) => {
    updateAuthParam(newView);
  }, [updateAuthParam]);

  return (
    <AuthContext.Provider value={{ isOpen, isAuthenticated, view, authError, openAuth, closeAuth, switchAuthView }}>
      {children}
      {isOpen ? <AuthPanel redirectTo={redirectTo} /> : null}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
