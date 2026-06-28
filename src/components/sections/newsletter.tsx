"use client";

import { useTranslations } from "next-intl";

import { DarkCTAButton } from "@/components/shared";

export function Newsletter() {
  const t = useTranslations("Newsletter");

  return (
    <section
      className="relative flex min-h-[576px] w-full justify-center overflow-hidden bg-cover bg-center py-16"
      style={{ backgroundImage: "url(/images/newsletter_bg.png)" }}
    >
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex w-full flex-col items-center justify-center gap-10 px-6 text-center">
        <div className="flex flex-col items-center gap-[35px]">
          <h2 className="text-3xl font-medium leading-9 sm:text-4xl sm:leading-10 lg:text-[46px] lg:leading-[56px] text-white">
            {t("title")}
          </h2>
          <p className="max-w-[720px] text-[14px] font-medium uppercase leading-5 text-white">
            {t("subtitle")}
          </p>
        </div>

        <form className="flex w-full max-w-[480px] flex-col gap-4">
          <label className="flex flex-col gap-2 text-left text-[14px] font-medium uppercase leading-5 text-white">
            {t("emailLabel")}
            <input
              type="email"
              aria-label={t("emailLabel")}
              className="border-b border-[#CFC9C0] bg-transparent py-3 text-white focus:border-white focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-left text-[14px] font-medium uppercase leading-5 text-white">
            {t("phoneLabel")}
            <input
              type="tel"
              aria-label={t("phoneLabel")}
              className="border-b border-[#CFC9C0] bg-transparent py-3 text-white focus:border-white focus:outline-none"
            />
          </label>

          <DarkCTAButton type="submit" variant="dark" className="min-h-[52px] min-w-[127px] leading-5">
            {t("cta")}
          </DarkCTAButton>
        </form>
      </div>
    </section>
  );
}
