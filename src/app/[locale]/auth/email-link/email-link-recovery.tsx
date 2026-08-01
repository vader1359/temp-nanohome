"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  FirebaseAuthUiError,
  getFirebaseBrowserAuthPort,
  type FirebaseBrowserAuthPort,
} from "@/lib/auth/firebase-browser-auth";
import { publishEmailLinkRecoverySignal } from "@/lib/auth/email-link-recovery";

type RecoveryState = "recovering" | "return_to_original_tab" | "expired" | "invalid" | "used" | "recent_sign_in" | "unknown";

function recoveryStateForError(error: unknown): RecoveryState {
  if (!(error instanceof FirebaseAuthUiError)) return "unknown";
  switch (error.code) {
    case "code_expired": return "expired";
    case "email_link_invalid": return "invalid";
    case "email_link_used": return "used";
    case "recent_sign_in_required": return "recent_sign_in";
    default: return "unknown";
  }
}

type EmailLinkRecoveryProps = Readonly<{
  readonly authPort?: Pick<FirebaseBrowserAuthPort, "recoverEmailLinkSession">;
  readonly actionCode?: string;
  readonly cleanPath: string;
  readonly fallbackPath: string;
  readonly locale: string;
  readonly mode?: string;
  readonly navigate?: (path: string) => void;
  readonly recoveryState?: string;
}>;

export function EmailLinkRecovery({
  actionCode,
  authPort,
  cleanPath,
  fallbackPath,
  locale,
  mode,
  navigate,
  recoveryState,
}: EmailLinkRecoveryProps) {
  const t = useTranslations("Account.emailLink");
  const [state, setState] = useState<RecoveryState>(() => recoveryState === undefined ? "invalid" : "recovering");
  const port = authPort ?? getFirebaseBrowserAuthPort();

  useEffect(() => {
    let cancelled = false;
    window.history.replaceState(window.history.state, "", cleanPath);
    if (recoveryState === undefined) {
      return () => {
        cancelled = true;
      };
    }

    void port.recoverEmailLinkSession({ actionCode, locale, mode, state: recoveryState })
      .then((destination) => {
        if (cancelled) return;
        if (destination === null) {
          publishEmailLinkRecoverySignal(recoveryState);
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
        setState(recoveryStateForError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [actionCode, cleanPath, locale, mode, navigate, port, recoveryState]);

  const message = state === "recovering"
    ? t("recovering")
    : state === "return_to_original_tab"
      ? t("returnToOriginalTab")
      : state === "expired"
        ? t("expired")
        : state === "invalid"
          ? t("invalid")
          : state === "used"
            ? t("used")
            : state === "recent_sign_in"
              ? t("recentSignIn")
              : t("unknown");

  return (
    <>
      <p aria-live="polite" className="text-sm leading-6 text-nh-muted" role="status">{message}</p>
      {state !== "recovering" ? (
        <a className="inline-flex min-h-11 items-center justify-center bg-nh-ink px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" href={fallbackPath}>
          {t("returnToSignIn")}
        </a>
      ) : null}
    </>
  );
}
