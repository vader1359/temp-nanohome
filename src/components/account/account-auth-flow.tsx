"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { User } from "firebase/auth";

import { InternationalPhoneField } from "@/components/account/international-phone-field";
import {
  FirebaseAuthUiError,
  getFirebaseBrowserAuthPort,
  type FirebaseAuthUiErrorCode,
  type FirebaseBrowserAuthPort,
  type FirebasePhoneConfirmation,
} from "@/lib/auth/firebase-browser-auth";
import { authCompletionState } from "@/lib/auth/checkout-identity";
import { normalizeEmail } from "@/lib/auth/email-normalization";
import {
  DEFAULT_PHONE_COUNTRY,
  normalizeInternationalPhone,
  type SupportedPhoneCountry,
} from "@/lib/auth/phone-e164";
import {
  EMAIL_LINK_RECOVERY_CHANNEL,
  EMAIL_LINK_RECOVERY_STORAGE_KEY,
  isFreshEmailLinkRecoverySignal,
  readEmailLinkRecoverySignal,
} from "@/lib/auth/email-link-recovery";
import type { AuthSessionIntent } from "@/lib/auth/session-intent";
import { cn } from "@/lib/utils";

type AccountAuthMethod = "password" | "phone_otp";
type AccountAuthStep = "entry" | "otp" | "email_required" | "email_verification" | "reset_sent";

type AccountAuthFlowProps = Readonly<{
  readonly authPort?: FirebaseBrowserAuthPort;
  readonly embedded?: boolean;
  readonly intent?: AuthSessionIntent;
  readonly locale: string;
  readonly navigate?: (path: string) => void;
  readonly returnTo: string;
}>;

const RECAPTCHA_CONTAINER_ID = "nanohome-phone-recaptcha";
const RESEND_COOLDOWN_SECONDS = 60;

function authErrorCode(error: unknown): FirebaseAuthUiErrorCode {
  return error instanceof FirebaseAuthUiError ? error.code : "unknown";
}

function completionForUser(user: User) {
  return authCompletionState({
    email: user.email,
    email_verified: user.emailVerified,
    phone_number: user.phoneNumber,
    uid: user.uid,
  });
}

export function AccountAuthFlow({
  authPort,
  embedded = false,
  intent = "account",
  locale,
  navigate,
  returnTo,
}: AccountAuthFlowProps) {
  const t = useTranslations("Account.authFlow");
  const port = useMemo(() => authPort ?? getFirebaseBrowserAuthPort(), [authPort]);
  const [method, setMethod] = useState<AccountAuthMethod>("phone_otp");
  const [step, setStep] = useState<AccountAuthStep>("entry");
  const [country, setCountry] = useState<SupportedPhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [identityUser, setIdentityUser] = useState<User | null>(null);
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

  const goTo = useCallback((path: string) => {
    if (navigate) {
      navigate(path);
      return;
    }
    window.location.assign(path);
  }, [navigate]);

  const handleFailure = useCallback((caught: unknown) => {
    setError(authErrorCode(caught));
    setPending(false);
  }, []);

  const completeSession = useCallback(async (user: User) => {
    const completion = completionForUser(user);
    if (completion !== "identity_complete") {
      setIdentityUser(user);
      setPending(false);
      setError(null);
      setMethod("phone_otp");
      setPhone("");
      setStep("entry");
      return;
    }

    const destination = await port.createServerSession(user, locale, returnTo, intent);
    setIdentityUser(null);
    setPending(false);
    goTo(destination);
  }, [goTo, intent, locale, port, returnTo]);

  useEffect(() => {
    let cancelled = false;
    void port.consumeGoogleRedirect()
      .then((user) => {
        if (user !== null && !cancelled) void completeSession(user).catch(handleFailure);
      })
      .catch(handleFailure);
    return () => {
      cancelled = true;
    };
  }, [completeSession, handleFailure, port]);

  const requestPhoneCode = async () => {
    const normalizedPhone = normalizeInternationalPhone(phone, country);
    if (normalizedPhone === null) {
      setError("invalid_phone");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const nextConfirmation = identityUser === null
        ? await port.requestPhoneCode(normalizedPhone, RECAPTCHA_CONTAINER_ID)
        : await port.requestPhoneCode(normalizedPhone, RECAPTCHA_CONTAINER_ID, identityUser);
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
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail === null || password === "") {
      setError("invalid_credentials");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await completeSession(await port.signInPassword(normalizedEmail, password));
    } catch (caught) {
      handleFailure(caught);
    }
  };

  const sendResetEmail = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail === null) {
      setError("invalid_credentials");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await port.sendPasswordReset(normalizedEmail, locale);
      setStep("reset_sent");
      setPending(false);
    } catch (caught) {
      handleFailure(caught);
    }
  };

  const sendEmailVerification = async () => {
    if (identityUser === null) {
      setError("unknown");
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail === null) {
      setError("invalid_credentials");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await port.verifyEmailBeforeUpdate(identityUser, normalizedEmail, locale, returnTo, intent);
      setEmail(normalizedEmail);
      setStep("email_verification");
      setPending(false);
    } catch (caught) {
      handleFailure(caught);
    }
  };

  const checkEmailVerification = useCallback(async () => {
    if (identityUser === null) {
      setError("unknown");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const refreshedUser = await port.reloadUser(identityUser);
      if (completionForUser(refreshedUser) !== "identity_complete") {
        setIdentityUser(refreshedUser);
        setError("email_verification_pending");
        setPending(false);
        return;
      }
      await completeSession(refreshedUser);
    } catch (caught) {
      handleFailure(caught);
    }
  }, [completeSession, handleFailure, identityUser, port]);

  useEffect(() => {
    if (step !== "email_verification" || identityUser === null) return;

    let completed = false;
    const recover = () => {
      if (completed) return;
      completed = true;
      void checkEmailVerification();
    };
    const channel = typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(EMAIL_LINK_RECOVERY_CHANNEL);
    channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (isFreshEmailLinkRecoverySignal(event.data)) recover();
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === EMAIL_LINK_RECOVERY_STORAGE_KEY && isFreshEmailLinkRecoverySignal(readEmailLinkRecoverySignal())) {
        recover();
      }
    };
    window.addEventListener("storage", onStorage);
    if (isFreshEmailLinkRecoverySignal(readEmailLinkRecoverySignal())) recover();

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [checkEmailVerification, identityUser, step]);

  const changePhone = () => {
    port.clearPhoneVerifier();
    const keepLinkUser = identityUser !== null && identityUser.phoneNumber === null;
    setIdentityUser(keepLinkUser ? identityUser : null);
    setConfirmation(null);
    setCooldown(0);
    setError(null);
    setOtp("");
    setPhone("");
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
          <p aria-live="polite" role="status" className="mt-2 text-sm leading-6 text-nh-muted">
            {identityUser === null ? t("verificationDescription") : t("phoneLinkDescription")}
          </p>
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

  if (step === "email_required" || step === "email_verification") {
    const verificationSent = step === "email_verification";
    return (
      <section aria-busy={pending} aria-labelledby="account-email-identity-title" className={shellClassName}>
        <p className="text-xs uppercase tracking-[0.24em] text-nh-accent">nanoHome</p>
        <header>
          <h1 className="text-2xl font-normal text-nh-ink" id="account-email-identity-title">
            {verificationSent ? t("emailVerificationTitle") : t("emailRequiredTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-nh-muted">
            {verificationSent ? t("emailVerificationDescription") : t("emailRequiredDescription")}
          </p>
        </header>
        {errorMessage ? <p role="alert" className="text-sm text-nh-red">{errorMessage}</p> : null}
        {verificationSent ? (
          <p aria-live="polite" role="status" className="rounded-sm bg-nh-surface px-4 py-3 text-sm text-nh-ink">
            {email}
          </p>
        ) : (
          <label className="grid gap-2 text-xs uppercase tracking-wider text-nh-ink" htmlFor="account-required-email">
            {t("email")}
            <input
              autoComplete="email"
              className="min-h-12 border-b border-nh-border bg-transparent px-1 text-base outline-none focus:border-nh-ink"
              disabled={pending}
              id="account-required-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
        )}
        {verificationSent ? (
          <div className="grid gap-3">
            <button
              className="min-h-12 bg-nh-ink px-4 text-sm font-medium uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending}
              onClick={() => void checkEmailVerification()}
              type="button"
            >
              {pending ? t("checkingEmailVerification") : t("checkEmailVerification")}
            </button>
            <button
              className="min-h-11 border border-nh-border px-3 text-sm text-nh-ink disabled:opacity-50"
              disabled={pending}
              onClick={() => void sendEmailVerification()}
              type="button"
            >
              {t("sendVerificationEmail")}
            </button>
          </div>
        ) : (
          <button
            className="min-h-12 bg-nh-ink px-4 text-sm font-medium uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending}
            onClick={() => void sendEmailVerification()}
            type="button"
          >
            {pending ? t("sendingVerificationEmail") : t("sendVerificationEmail")}
          </button>
        )}
        <button
          className="min-h-11 border border-nh-border px-3 text-sm text-nh-ink"
          disabled={pending}
          onClick={changePhone}
          type="button"
        >
          {t("changePhone")}
        </button>
      </section>
    );
  }

  return (
    <section aria-busy={pending} aria-labelledby="account-sign-in-title" className={shellClassName}>
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-nh-accent">nanoHome</p>
        <h1 className="mt-3 text-2xl font-normal text-nh-ink" id="account-sign-in-title">{t("signIn")}</h1>
        <p className="mt-2 text-sm leading-6 text-nh-muted">
          {identityUser === null ? t("description") : t("phoneLinkDescription")}
        </p>
      </header>

      {errorMessage ? <p role="alert" className="text-sm text-nh-red">{errorMessage}</p> : null}

      {method === "phone_otp" ? (
        <div className="grid gap-5">
          <InternationalPhoneField
            country={country}
            disabled={pending}
            id="account-phone"
            onChange={setPhone}
            onCountryChange={setCountry}
            value={phone}
          />
          <p className="text-xs leading-5 text-nh-muted">{t("smsNotice")}</p>
          <div aria-hidden="true" id={RECAPTCHA_CONTAINER_ID} />
          <button
            className="min-h-12 bg-nh-ink px-4 text-sm font-medium uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending}
            onClick={() => void requestPhoneCode()}
            type="button"
          >
            {pending ? t("sendingOtp") : identityUser === null ? t("sendOtp") : t("linkPhone")}
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

      {identityUser === null ? (
        <>
          <div aria-label={t("methodListLabel")} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <button
              aria-pressed={method === "phone_otp"}
              className={cn("min-h-10 border px-3 text-sm", method === "phone_otp" ? "border-nh-ink bg-nh-ink text-white" : "border-nh-border text-nh-ink")}
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
              className={cn("min-h-10 border px-3 text-sm", method === "password" ? "border-nh-ink bg-nh-ink text-white" : "border-nh-border text-nh-ink")}
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
          <div className="relative py-1 text-center text-xs uppercase tracking-wider text-nh-muted before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t before:border-nh-border">
            <span className="relative bg-white px-3">{t("or")}</span>
          </div>
          <button
            className="min-h-10 border border-nh-border bg-white px-4 text-sm font-medium text-nh-ink disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending}
            onClick={() => void signInWithGoogle()}
            type="button"
          >
            {t("google")}
          </button>
          <p className="text-xs leading-5 text-nh-muted">{t("googleNotice")}</p>
        </>
      ) : null}
    </section>
  );
}
