"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AuthPanel } from "./auth-panel";

export type AuthView = "login" | "register" | "forgot" | "register_success" | "forgot_sent";

interface AuthContextValue {
  isOpen: boolean;
  view: AuthView;
  authError: string | null;
  openAuth: (view?: AuthView) => void;
  closeAuth: () => void;
  switchAuthView: (view: AuthView) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const authParam = searchParams.get("auth");
  const isOpen = authParam !== null;
  const view: AuthView = authParam === "register" || authParam === "sign_up_error" ? "register" 
    : authParam === "forgot" || authParam === "forgot_error" ? "forgot"
    : authParam === "register_success" ? "register_success"
    : authParam === "forgot_sent" ? "forgot_sent"
    : "login";
  const authError = authParam === "sign_in_error" || authParam === "sign_up_error" || authParam === "forgot_error" || authParam === "invalid_credentials" ? authParam : null;
  const redirectTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

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
    <AuthContext.Provider value={{ isOpen, view, authError, openAuth, closeAuth, switchAuthView }}>
      {children}
      <AuthPanel redirectTo={redirectTo} />
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
