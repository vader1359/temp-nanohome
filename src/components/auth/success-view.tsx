"use client";

import { useTranslations } from "next-intl";
import { DarkCTAButton } from "@/components/shared/dark-cta-button";

interface SuccessFormProps {
  type: "register_success" | "forgot_sent";
  onClose: () => void;
}

export function SuccessView({ type, onClose }: SuccessFormProps) {
  const t = useTranslations("Auth");

  const title = type === "register_success" ? t("register.successTitle") : t("forgot.sentTitle");
  const subtitle = type === "register_success" ? t("register.successBody") : t("forgot.sentBody");

  return (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="flex-1 overflow-y-auto pr-2 pb-6">
        <h2 className="text-2xl font-normal leading-8 text-nh-ink mb-2">
          {title}
        </h2>
        <p className="text-sm text-nh-muted leading-5 mb-8">
          {subtitle}
        </p>

        <DarkCTAButton type="button" onClick={onClose} className="w-full">
          {t("common.continueShopping")}
        </DarkCTAButton>
      </div>
    </div>
  );
}
