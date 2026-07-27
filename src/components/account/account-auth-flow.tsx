"use client";

import { useReducer, useState } from "react";
import { useTranslations } from "next-intl";

import { parseAccountAuthFlowOutcome, type AccountAuthFlowMethod } from "@/lib/account/auth-flow";

import { initialAccountAuthFlowState, reduceAccountAuthFlow } from "./account-auth-flow-state";

type AccountAuthFlowProps = Readonly<{ readonly locale: string; readonly returnTo: string }>;

type AccountAuthFlowMethodOption = Readonly<{
  readonly method: AccountAuthFlowMethod;
  readonly translationKey: "magicLink" | "password" | "google" | "kakao" | "phoneOtp";
}>;

const methods: readonly AccountAuthFlowMethodOption[] = [
  { method: "magic_link", translationKey: "magicLink" },
  { method: "password", translationKey: "password" },
  { method: "google", translationKey: "google" },
  { method: "kakao", translationKey: "kakao" },
  { method: "phone_otp", translationKey: "phoneOtp" },
];

function assertNever(value: never): never {
  throw new Error(`Unexpected auth flow state: ${JSON.stringify(value)}`);
}

export function AccountAuthFlow({ locale, returnTo }: AccountAuthFlowProps) {
  const t = useTranslations("Account.authFlow");
  const [state, dispatch] = useReducer(reduceAccountAuthFlow, initialAccountAuthFlowState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const pending = state.kind === "submitting";
  const selected = state.kind === "completed" ? "magic_link" : state.method;

  const submit = async (action: "start" | "verify") => {
    dispatch({ kind: "submit" });
    try {
      const response = await fetch("/api/account/auth-flow", {
        body: JSON.stringify({ action, email, locale, method: selected, otp, password, phone, returnTo }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        dispatch({ kind: "outcome", outcome: { kind: "retryable_error" } });
        return;
      }
      dispatch({ kind: "outcome", outcome: parseAccountAuthFlowOutcome(await response.json()) });
    } catch (error) {
      if (error instanceof Error) {
        dispatch({ kind: "outcome", outcome: { kind: "retryable_error" } });
        return;
      }
      throw error;
    }
  };

  switch (state.kind) {
    case "completed":
      return <section aria-labelledby="account-sign-in-title" className="mx-auto flex w-full max-w-md flex-col gap-6 border border-nh-border bg-white p-6 md:p-8"><h1 className="text-2xl font-medium text-nh-ink" id="account-sign-in-title">{t("signInComplete")}</h1><p aria-live="polite" role="status" className="text-sm leading-6 text-nh-muted">{t("signInCompleteDescription")}</p><a className="inline-flex min-h-11 items-center justify-center bg-nh-ink px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" href={state.returnTo}>{t("continueToDestination")}</a></section>;
    case "selecting":
    case "retryable_error":
    case "submitting":
      return <section aria-labelledby="account-sign-in-title" className="mx-auto flex w-full max-w-md flex-col gap-6 border border-nh-border bg-white p-6 md:p-8"><header><h1 className="text-2xl font-medium text-nh-ink" id="account-sign-in-title">{t("signIn")}</h1><p className="mt-2 text-sm leading-6 text-nh-muted">{t("description")}</p></header>{state.kind === "retryable_error" ? <p role="alert" className="text-sm text-nh-red">{t("error")}</p> : null}<div aria-label={t("methodListLabel")} className="grid gap-2">{methods.map(({ method, translationKey }) => <button key={method} type="button" disabled={pending} aria-pressed={selected === method} onClick={() => dispatch({ kind: "choose", method })} className="min-h-11 border border-nh-border px-4 text-left text-sm text-nh-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent disabled:opacity-50">{t(translationKey)}</button>)}</div>{selected === "password" ? <label className="grid gap-2 text-sm text-nh-ink">{t("password")}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="min-h-11 border border-nh-border px-3" /></label> : null}{selected === "magic_link" ? <label className="grid gap-2 text-sm text-nh-ink">{t("email")}<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="min-h-11 border border-nh-border px-3" /></label> : null}{selected === "phone_otp" ? <label className="grid gap-2 text-sm text-nh-ink">{t("phoneNumber")}<input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" className="min-h-11 border border-nh-border px-3" /></label> : null}<button type="button" disabled={pending} onClick={() => void submit("start")} className="min-h-11 bg-nh-ink px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? t("continue") : state.kind === "retryable_error" ? t("tryAgain") : t("continue")}</button>{state.kind === "retryable_error" ? <><button type="button" onClick={() => dispatch({ kind: "back" })} className="min-h-11 text-sm text-nh-accent underline">{t("back")}</button><button type="button" onClick={() => dispatch({ kind: "change_method" })} className="min-h-11 text-sm text-nh-accent underline">{t("chooseAnotherMethod")}</button></> : null}</section>;
    case "verifying":
      return <section aria-labelledby="account-verification-title" className="mx-auto flex w-full max-w-md flex-col gap-6 border border-nh-border bg-white p-6 md:p-8"><header><h1 className="text-2xl font-medium text-nh-ink" id="account-verification-title">{t("verifySignIn")}</h1><p aria-live="polite" role="status" className="mt-2 text-sm leading-6 text-nh-muted">{t("verificationDescription")}</p></header><label className="grid gap-2 text-sm text-nh-ink">{t("verificationCode")}<input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" className="min-h-11 border border-nh-border px-3" /></label><button type="button" disabled={pending} onClick={() => void submit("verify")} className="min-h-11 bg-nh-ink px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? t("verifying") : t("verifyCode")}</button><button type="button" onClick={() => dispatch({ kind: "back" })} className="min-h-11 text-sm text-nh-accent underline">{t("back")}</button><button type="button" onClick={() => dispatch({ kind: "change_method" })} className="min-h-11 text-sm text-nh-accent underline">{t("chooseAnotherMethod")}</button></section>;
    default:
      return assertNever(state);
  }
}
