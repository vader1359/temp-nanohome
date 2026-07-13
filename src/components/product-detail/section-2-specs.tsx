"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { specColumns as fallbackSpecColumns } from "./mock-data";

interface Section2SpecsProps {
  specColumns?: typeof fallbackSpecColumns;
  description?: string | null;
  designerDescription?: string | null;
  designerPortraitUrl?: string | null;
}

export function Section2Specs({ specColumns = fallbackSpecColumns, description, designerDescription, designerPortraitUrl }: Section2SpecsProps) {
  const t = useTranslations("ProductDetail");
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [t("specificationsTab"), t("introductionTab"), t("designerTab")];
  return (
    <section className="flex flex-col items-center gap-12 bg-[#F5F3F0] py-12 md:py-16">
      {/* Title */}
      <h2 className="text-center text-[32px] font-medium text-[#666]">
        {t("detailsTitle")}
      </h2>

      {/* Tabs */}
      <div className="flex justify-center gap-[21px]">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`text-[12px] font-normal transition ${
              activeTab === i ? "text-[#111]" : "text-[#8A8178]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Spec cards — 2 columns */}
      {activeTab === 0 && (
        <div className="mx-auto flex w-full max-w-[1024px] flex-col gap-6 px-4 md:flex-row md:gap-12">
          {specColumns.map((col, ci) => (
            <div key={ci} className="flex flex-1 flex-col gap-4">
              {col.map((spec) => (
                <div
                  key={spec.label}
                  className="flex flex-col gap-1 bg-white px-6 py-3"
                >
                  <span className="text-[14px] font-medium uppercase text-[#111]">
                    {spec.label}
                  </span>
                  <div className="flex items-start gap-2">
                    <span className="whitespace-pre-line text-[14px] font-normal text-[#666]">
                      {spec.value}
                    </span>
                    {spec.link && (
                      <a
                        href="#"
                        className="text-[12px] font-medium text-[#B0946F] hover:underline"
                      >
                        {spec.link}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === 1 && (
        <div className="mx-auto max-w-[1024px] w-full px-4 text-[14px] leading-relaxed text-[#666]">
          <p>
            {description ??
              t("descriptionFallback")}
          </p>
        </div>
      )}

      {activeTab === 2 && (
        <div className="mx-auto flex w-full max-w-[1024px] flex-col gap-6 text-[14px] text-[#666] md:flex-row md:items-start md:gap-8 px-4">
          {designerPortraitUrl && designerPortraitUrl.startsWith("http") && (
            <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-full bg-white">
              <Image
                src={designerPortraitUrl}
                alt={t("designerHeading")}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div>
            <h3 className="mb-2 text-[16px] font-medium text-[#111]">{t("designerHeading")}</h3>
            <p>{designerDescription ?? t("designerFallback")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
