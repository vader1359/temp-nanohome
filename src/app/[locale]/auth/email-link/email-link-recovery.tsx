"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  FirebaseAuthUiError,
  getFirebaseBrowserAuthPort,
  type FirebaseBrowserAuthPort,
} from "@/lib/auth/firebase-browser-auth";
import { publishEmailLinkRecoverySignal } from "@/lib/auth/email-link-recovery";
import type { AuthSessionIntent } from "@/lib/auth/session-intent";

type RecoveryState = "recovering" | "return_to_original_tab" | "expired" | "invalid" | "unknown";

type EmailLinkRecoveryProps = Readonly<{
  readonly authPort?: Pick<FirebaseBrowserAuthPort, "recoverEmailLinkSession">;
  readonly intent: AuthSessionIntent;
  readonly locale: string;
  readonly navigate?: (path: string) => void;
  readonly returnTo: string;
}>;

export function EmailLinkRecovery({ authPort, intent, locale, navigate, returnTo }: EmailLinkRecoveryProps) {
  const t = useTranslations("Account.emailLink");
  const [state, setState] = useState<RecoveryState>("recovering");
  const port = authPort ?? getFirebaseBrowserAuthPort();

  useEffect(() => {
    let cancelled = false;
    void port.recoverEmailLinkSession(locale, returnTo, intent)
      .then((destination) => {
        if (cancelled) return;
        if (destination === null) {
          publishEmailLinkRecoverySignal();
          setState("return_to_original_tab");
          return;
        }
        if (navigate) {
          navigate(destination);
          return;
        }
        window.location.replace(destination);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const code = error instanceof FirebaseAuthUiError ? error.code : "unknown";
        setState(code === "code_expired" ? "expired" : code === "email_link_invalid" ? "invalid" : "unknown");
      });
    return () => {
      cancelled = true;
    };
  }, [intent, locale, navigate, port, returnTo]);

  const message = state === "recovering"
    ? t("recovering")
    : state === "return_to_original_tab"
      ? t("returnToOriginalTab")
      : state === "expired"
        ? t("expired")
        : state === "invalid"
          ? t("invalid")
          : t("unknown");

  return (
    <>
      <p aria-live="polite" className="text-sm leading-6 text-nh-muted" role="status">{message}</p>
      {state !== "recovering" ? (
        <a className="inline-flex min-h-11 items-center justify-center bg-nh-ink px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" href={returnTo}>
          {t("returnToCheckout")}
        </a>
      ) : null}
    </>
  );
}
