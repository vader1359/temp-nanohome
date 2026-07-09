"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { ForgotPasswordForm } from "./forgot-password-form";
import { SuccessView } from "./success-view";
import { useAuthContext } from "./auth-provider";

type AuthPanelProps = {
  readonly redirectTo: string;
};

export function AuthPanel({ redirectTo }: AuthPanelProps) {
  const t = useTranslations("Auth");
  const { isOpen, view, authError, closeAuth, switchAuthView } = useAuthContext();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeAuth();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeAuth]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] transition-opacity duration-300 pointer-events-none",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
      )}
      aria-hidden={!isOpen}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={closeAuth}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("login.title")}
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-[392px] border-l border-nh-border bg-white pt-6 pb-8 px-6 lg:px-8 flex flex-col transition-transform duration-300 ease-in-out sm:w-full",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <button
          onClick={closeAuth}
          className="absolute top-6 right-6 p-2 text-nh-ink hover:opacity-70 transition-opacity"
          aria-label={t("common.close")}
        >
          <X className="w-5 h-5 stroke-[1.5]" />
        </button>

        <div className="mt-12 flex-1 min-h-0">
          {view === "login" && (
            <LoginForm onSwitchView={switchAuthView} authError={authError ?? undefined} redirectTo={redirectTo} />
          )}
          {view === "register" && (
            <RegisterForm onSwitchView={switchAuthView} authError={authError ?? undefined} redirectTo={redirectTo} />
          )}
          {view === "forgot" && (
            <ForgotPasswordForm onSwitchView={switchAuthView} authError={authError ?? undefined} redirectTo={redirectTo} />
          )}
          {view === "register_success" && (
            <SuccessView type="register_success" onClose={closeAuth} />
          )}
          {view === "forgot_sent" && (
            <SuccessView type="forgot_sent" onClose={closeAuth} />
          )}
        </div>
      </div>
    </div>
  );
}
