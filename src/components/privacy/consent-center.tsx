"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { clientCustomerContextSchema, type ClientCustomerContext } from "@/lib/contracts/schemas";
import type { Locale } from "@/i18n/routing";

const POLICY_VERSION = "2026-07-23";

type ConsentCenterProps = Readonly<{ locale: Locale }>;
type Choice = "essential" | "experience" | "withdraw";

export function ConsentCenter({ locale }: ConsentCenterProps) {
  const t = useTranslations("Privacy");
  const [context, setContext] = useState<ClientCustomerContext | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const loadContext = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve();
    if (signal?.aborted) return;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/customer/context", {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      if (!response.ok) throw new Error("context unavailable");
      const parsed = clientCustomerContextSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("context invalid");
      setContext(parsed.data);
      if (parsed.data.consent.version === "none") setIsOpen(true);
    } catch (loadError: unknown) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(true);
      setIsOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadContext(controller.signal); }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadContext]);

  useEffect(() => {
    const openSettings = () => setIsOpen(true);
    window.addEventListener("nanohome:open-consent-settings", openSettings);
    return () => window.removeEventListener("nanohome:open-consent-settings", openSettings);
  }, []);

  const save = async (choice: Choice) => {
    setSaving(true);
    setError(false);
    const experience = choice === "experience";
    const payload = choice === "withdraw"
      ? {
          analytics: false,
          personalization: false,
          aiProcessing: false,
          aiConversationStorage: false,
          roomImageProcessing: false,
          roomImageStorage: false,
          marketing: false,
          version: POLICY_VERSION,
          locale,
          source: "privacy-center",
          withdrawn: true,
          withdrawalReason: "customer privacy choice",
        }
      : {
          analytics: experience,
          personalization: experience,
          aiProcessing: experience,
          aiConversationStorage: false,
          roomImageProcessing: false,
          roomImageStorage: false,
          marketing: false,
          version: POLICY_VERSION,
          locale,
          source: context?.consent.version === "none" ? "banner" : "settings",
        };
    try {
      const response = await fetch("/api/customer/consent", {
        body: JSON.stringify(payload),
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) throw new Error("consent unavailable");
      const parsed = clientCustomerContextSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("consent invalid");
      setContext(parsed.data);
      setIsOpen(false);
      window.dispatchEvent(new Event("nanohome:customer-context-changed"));
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const hasDecision = context !== null && context.consent.version !== "none";
  if (loading && !isOpen) return null;

  return (
    <>
      {hasDecision && !isOpen ? (
        <button
          type="button"
          className="fixed bottom-4 left-4 z-[70] rounded-full border border-neutral-400 bg-white px-4 py-2 text-sm text-neutral-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          onClick={() => setIsOpen(true)}
        >
          {t("settings")}
        </button>
      ) : null}
      {isOpen ? (
        <section
          aria-labelledby="privacy-consent-title"
          aria-describedby="privacy-consent-description"
          className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-2xl rounded-lg border border-neutral-300 bg-white p-5 text-neutral-950 shadow-xl sm:p-6"
          role="dialog"
        >
          <h2 id="privacy-consent-title" className="text-base font-semibold sm:text-lg">{t("title")}</h2>
          <p id="privacy-consent-description" className="mt-2 text-sm leading-6 text-neutral-700">{t("description")}</p>
          <p className="mt-2 text-xs leading-5 text-neutral-600">{t("storageNotice")}</p>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">{t("error")}</p>
          ) : null}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="min-h-11 rounded border border-neutral-500 bg-white px-4 py-2 text-sm font-medium text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || loading}
              onClick={() => { void save("essential"); }}
            >
              {t("essentialOnly")}
            </button>
            <button
              type="button"
              className="min-h-11 rounded border border-neutral-500 bg-white px-4 py-2 text-sm font-medium text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || loading}
              onClick={() => { void save("experience"); }}
            >
              {t("improveExperience")}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {hasDecision ? (
              <button
                type="button"
                className="text-sm underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || loading}
                onClick={() => { void save("withdraw"); }}
              >
                {t("withdraw")}
              </button>
            ) : <span />}
            {error ? (
              <button
                type="button"
                className="text-sm underline underline-offset-4"
                disabled={loading || saving}
                onClick={() => { void loadContext(); }}
              >
                {t("retry")}
              </button>
            ) : null}
            {hasDecision ? (
              <button type="button" className="text-sm underline underline-offset-4" onClick={() => setIsOpen(false)}>
                {t("close")}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
