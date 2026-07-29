"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { User } from "firebase/auth";

import {
  FirebaseAuthUiError,
  getFirebaseBrowserAuthPort,
  type FirebaseAuthUiErrorCode,
  type FirebaseBrowserAuthPort,
  type FirebasePhoneConfirmation,
} from "@/lib/auth/firebase-browser-auth";
import { normalizeVietnamPhone } from "@/lib/auth/phone";
import { cn } from "@/lib/utils";

type AccountAuthMethod = "password" | "phone_otp";
type AccountAuthStep = "entry" | "otp" | "reset_sent";

type AccountAuthFlowProps = Readonly<{
  readonly authPort?: FirebaseBrowserAuthPort;
  readonly embedded?: boolean;
  readonly locale: string;
  readonly navigate?: (path: string) => void;
  readonly returnTo: string;
}>;

const RECAPTCHA_CONTAINER_ID = "nanohome-phone-recaptcha";
const RESEND_COOLDOWN_SECONDS = 60;

function authErrorCode(error: unknown): FirebaseAuthUiErrorCode {
  return error instanceof FirebaseAuthUiError ? error.code : "unknown";
}

export function AccountAuthFlow({
  authPort,
  embedded = false,
  locale,
  navigate,
  returnTo,
}: AccountAuthFlowProps) {
  const t = useTranslations("Account.authFlow");
  const port = useMemo(() => authPort ?? getFirebaseBrowserAuthPort(), [authPort]);
  const [method, setMethod] = useState<AccountAuthMethod>("phone_otp");
  const [step, setStep] = useState<AccountAuthStep>("entry");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState<FirebasePhoneConfirmation | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<FirebaseAuthUiErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => () => port.clearPhoneVerifier(), [port]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const goTo = (path: string) => {
    if (navigate) {
      navigate(path);
      return;
    }
    window.location.assign(path);
  };

  const completeSession = async (user: User) => {
    const destination = await port.createServerSession(user, locale, returnTo);
    setPending(false);
    goTo(destination);
  };

  useEffect(() => {
    let cancelled = false;
    void port.consumeGoogleRedirect().then((user) => {
      if (user !== null && !cancelled) void completeSession(user).catch(handleFailure);
    }).catch(handleFailure);
    return () => {
      cancelled = true;
    };
  }, [port]);

  const handleFailure = (caught: unknown) => {
    setError(authErrorCode(caught));
    setPending(false);
  };

  const requestPhoneCode = async () => {
    const normalizedPhone = normalizeVietnamPhone(phone);
    if (normalizedPhone === null) {
      setError("invalid_phone");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const nextConfirmation = await port.requestPhoneCode(normalizedPhone, RECAPTCHA_CONTAINER_ID);
      setConfirmation(nextConfirmation);
      setOtp("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep("otp");
      setPending(false);
    } catch (caught) {
      handleFailure(caught);
    }
  };

  const verifyPhoneCode = async () => {
    if (confirmation === null || !/^\d{6}$/u.test(otp)) {
      setError("invalid_code");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await completeSession(await confirmation.confirm(otp));
    } catch (caught) {
      handleFailure(caught);
    }
  };

  const signInWithGoogle = async () => {
    setPending(true);
    setError(null);
    try {
      await port.startGoogleRedirect();
    } catch (caught) {
      handleFailure(caught);
    }
  };

  const signInWithPassword = async () => {
    if (email.trim() === "" || password === "") {
      setError("invalid_credentials");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await completeSession(await port.signInPassword(email.trim(), password));
    } catch (caught) {
      handleFailure(caught);
    }
  };

  const sendResetEmail = async () => {
    if (email.trim() === "") {
      setError("invalid_credentials");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await port.sendPasswordReset(email.trim(), locale);
      setStep("reset_sent");
      setPending(false);
    } catch (caught) {
      handleFailure(caught);
    }
  };

  const changePhone = () => {
    port.clearPhoneVerifier();
    setConfirmation(null);
    setCooldown(0);
    setError(null);
    setOtp("");
    setStep("entry");
    setMethod("phone_otp");
  };

  const errorMessage = error === null ? null : t(`errors.${error}`);
  const shellClassName = cn(
    "mx-auto flex w-full max-w-md flex-col gap-6 bg-white p-6 md:p-8",
    embedded ? "p-0 md:p-0" : "border border-nh-border",
  );

  if (step === "reset_sent") {
    return (
      <section aria-labelledby="account-sign-in-title" className={shellClassName}>
        <p className="text-xs uppercase tracking-[0.24em] text-nh-accent">nanoHome</p>
        <h1 className="text-2xl font-normal text-nh-ink" id="account-sign-in-title">{t("resetSentTitle")}</h1>
        <p aria-live="polite" role="status" className="text-sm leading-6 text-nh-muted">{t("resetSentDescription")}</p>
        <button
          className="min-h-11 border border-nh-ink px-4 text-sm font-medium text-nh-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent"
          onClick={() => setStep("entry")}
          type="button"
        >
          {t("back")}
        </button>
      </section>
    );
  }

  if (step === "otp") {
    return (
      <section aria-busy={pending} aria-labelledby="account-verification-title" className={shellClassName}>
        <p className="text-xs uppercase tracking-[0.24em] text-nh-accent">nanoHome</p>
        <header>
          <h1 className="text-2xl font-normal text-nh-ink" id="account-verification-title">{t("verifySignIn")}</h1>
          <p aria-live="polite" role="status" className="mt-2 text-sm leading-6 text-nh-muted">{t("verificationDescription")}</p>
        </header>
        {errorMessage ? <p role="alert" className="text-sm text-nh-red">{errorMessage}</p> : null}
        <label className="grid gap-2 text-xs uppercase tracking-wider text-nh-ink" htmlFor="account-phone-otp">
          {t("verificationCode")}
          <input
            autoComplete="one-time-code"
            autoFocus
            className="min-h-12 border-b border-nh-border bg-transparent px-1 text-center text-2xl tracking-[0.4em] outline-none focus:border-nh-ink"
            disabled={pending}
            id="account-phone-otp"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setOtp(event.target.value.replace(/\D/gu, "").slice(0, 6))}
            pattern="[0-9]{6}"
            value={otp}
          />
        </label>
        <button
          className="min-h-12 bg-nh-ink px-4 text-sm font-medium uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || otp.length !== 6}
          onClick={() => void verifyPhoneCode()}
          type="button"
        >
          {pending ? t("verifying") : t("verifyCode")}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            className="min-h-11 border border-nh-border px-3 text-sm text-nh-ink disabled:opacity-50"
            disabled={pending || cooldown > 0}
            onClick={() => void requestPhoneCode()}
            type="button"
          >
            {cooldown > 0 ? `${t("resendIn")} ${cooldown}s` : t("resend")}
          </button>
          <button
            className="min-h-11 border border-nh-border px-3 text-sm text-nh-ink"
            disabled={pending}
            onClick={changePhone}
            type="button"
          >
            {t("changePhone")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-busy={pending} aria-labelledby="account-sign-in-title" className={shellClassName}>
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-nh-accent">nanoHome</p>
        <h1 className="mt-3 text-2xl font-normal text-nh-ink" id="account-sign-in-title">{t("signIn")}</h1>
        <p className="mt-2 text-sm leading-6 text-nh-muted">{t("description")}</p>
      </header>

      {errorMessage ? <p role="alert" className="text-sm text-nh-red">{errorMessage}</p> : null}

      <div aria-label={t("methodListLabel")} className="grid grid-cols-2 gap-2">
        <button
          aria-pressed={method === "phone_otp"}
          className={cn("min-h-11 border px-3 text-sm", method === "phone_otp" ? "border-nh-ink bg-nh-ink text-white" : "border-nh-border text-nh-ink")}
          disabled={pending}
          onClick={() => {
            setError(null);
            setMethod("phone_otp");
          }}
          type="button"
        >
          {t("phoneOtp")}
        </button>
        <button
          aria-pressed={method === "password"}
          className={cn("min-h-11 border px-3 text-sm", method === "password" ? "border-nh-ink bg-nh-ink text-white" : "border-nh-border text-nh-ink")}
          disabled={pending}
          onClick={() => {
            setError(null);
            setMethod("password");
          }}
          type="button"
        >
          {t("emailPassword")}
        </button>
      </div>

      {method === "phone_otp" ? (
        <div className="grid gap-5">
          <label className="grid gap-2 text-xs uppercase tracking-wider text-nh-ink" htmlFor="account-phone">
            {t("phoneNumber")}
            <input
              autoComplete="tel"
              className="min-h-12 border-b border-nh-border bg-transparent px-1 text-base outline-none focus:border-nh-ink"
              disabled={pending}
              id="account-phone"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="090 123 4567"
              type="tel"
              value={phone}
            />
          </label>
          <p className="text-xs leading-5 text-nh-muted">{t("smsNotice")}</p>
          <div aria-hidden="true" id={RECAPTCHA_CONTAINER_ID} />
          <button
            className="min-h-12 bg-nh-ink px-4 text-sm font-medium uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending}
            onClick={() => void requestPhoneCode()}
            type="button"
          >
            {pending ? t("sendingOtp") : t("sendOtp")}
          </button>
        </div>
      ) : (
        <div className="grid gap-5">
          <label className="grid gap-2 text-xs uppercase tracking-wider text-nh-ink" htmlFor="account-email">
            {t("email")}
            <input
              autoComplete="email"
              className="min-h-12 border-b border-nh-border bg-transparent px-1 text-base outline-none focus:border-nh-ink"
              disabled={pending}
              id="account-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="grid gap-2 text-xs uppercase tracking-wider text-nh-ink" htmlFor="account-password">
            {t("password")}
            <span className="relative">
              <input
                autoComplete="current-password"
                className="min-h-12 w-full border-b border-nh-border bg-transparent px-1 pr-20 text-base outline-none focus:border-nh-ink"
                disabled={pending}
                id="account-password"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                className="absolute inset-y-0 right-0 min-h-11 px-2 text-xs normal-case tracking-normal text-nh-accent"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? t("hidePassword") : t("showPassword")}
              </button>
            </span>
          </label>
          <button
            className="min-h-12 bg-nh-ink px-4 text-sm font-medium uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending}
            onClick={() => void signInWithPassword()}
            type="button"
          >
            {pending ? t("signingIn") : t("signInWithEmail")}
          </button>
          <button
            className="min-h-11 text-sm text-nh-accent underline underline-offset-4 disabled:opacity-50"
            disabled={pending}
            onClick={() => void sendResetEmail()}
            type="button"
          >
            {t("forgotPassword")}
          </button>
          <a className="min-h-11 text-center text-sm text-nh-ink underline underline-offset-4" href={`/${locale}?auth=register`}>
            {t("createAccount")}
          </a>
        </div>
      )}

      <div className="relative py-1 text-center text-xs uppercase tracking-wider text-nh-muted before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t before:border-nh-border">
        <span className="relative bg-white px-3">{t("or")}</span>
      </div>
      <button
        className="min-h-12 border border-nh-ink bg-white px-4 text-sm font-medium text-nh-ink disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending}
        onClick={() => void signInWithGoogle()}
        type="button"
      >
        {t("google")}
      </button>
      <p className="text-xs leading-5 text-nh-muted">{t("googleNotice")}</p>
    </section>
  );
}
