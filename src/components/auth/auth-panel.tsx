"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { AccountAuthFlow } from "@/components/account/account-auth-flow";
import { RegisterForm } from "./register-form";
import { ForgotPasswordForm } from "./forgot-password-form";
import { SuccessView } from "./success-view";
import { useAuthContext } from "./auth-provider";

type AuthPanelProps = {
  readonly redirectTo: string;
};

export function AuthPanel({ redirectTo }: AuthPanelProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const { isOpen, view, authError, closeAuth, switchAuthView } = useAuthContext();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const dialogLabel = view === "login"
    ? t("login.title")
    : view === "register"
      ? t("register.title")
      : view === "forgot"
        ? t("forgot.title")
        : view === "register_success"
          ? t("register.successTitle")
          : t("forgot.sentTitle");

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const originalBodyOverflow = document.body.style.overflow;
      const originalDocumentOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      closeButtonRef.current?.focus();
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalDocumentOverflow;
        window.requestAnimationFrame(() => {
          if (previousFocusRef.current?.isConnected) {
            previousFocusRef.current.focus();
            return;
          }

          document.querySelector<HTMLElement>("[data-auth-trigger]")?.focus();
        });
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !isOpen || panelRef.current === null) {
      return;
    }

    const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
    );
    const firstElement = focusableElements.item(0);
    const lastElement = focusableElements.item(focusableElements.length - 1);

    if (firstElement === null || lastElement === null) {
      event.preventDefault();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] transition-opacity duration-300 pointer-events-none",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
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
        aria-label={dialogLabel}
        onKeyDown={handleKeyDown}
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-[392px] border-l border-nh-border bg-white pt-6 pb-8 px-6 lg:px-8 flex flex-col transition-transform duration-300 ease-in-out sm:w-full",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <button
          onClick={closeAuth}
          ref={closeButtonRef}
          className="absolute top-5 right-5 flex size-11 items-center justify-center text-nh-ink hover:opacity-70 transition-opacity"
          aria-label={t("common.close")}
        >
          <X className="size-5 stroke-[1.5]" />
        </button>

        <div className="mt-12 flex-1 min-h-0">
          {view === "login" && (
            <AccountAuthFlow
              embedded
              intent={/(?:^|\/)checkout(?:[/?#]|$)/u.test(redirectTo) ? "checkout" : "account"}
              locale={locale}
              returnTo={redirectTo}
            />
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
