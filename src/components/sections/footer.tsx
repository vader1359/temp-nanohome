"use client";

import { ChevronRight, Globe, Mail, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { IconTextRow } from "@/components/shared";
import { cn } from "@/lib/utils";

const linkColumns = [
  {
    heading: "col1Heading",
    links: ["col1Link1", "col1Link2", "col1Link3", "col1Link4", "col1Link5"],
  },
  {
    heading: "col2Heading",
    links: ["col2Link1", "col2Link2"],
  },
  {
    heading: "col3Heading",
    links: ["col3Link1", "col3Link2", "col3Link3", "col3Link4"],
  },
  {
    heading: "col4Heading",
    links: ["col4Link1", "col4Link2", "col4Link3", "col4Link4"],
  },
] as const;

const showrooms = ["showroom1", "showroom2", "showroom3", "showroom4", "showroom5"] as const;

const contacts = [
  { icon: Phone, key: "phone" },
  { icon: Mail, key: "email" },
  { icon: Globe, key: "website" },
] as const;

export function Footer() {
  const t = useTranslations("Footer");
  const [openShowroom, setOpenShowroom] = useState<number | null>(0);

  return (
    <footer className="min-h-[480px] bg-[#1F1F1F] px-6 pt-20 pb-12 md:px-12 md:pt-24 md:pb-7">
      <div className="mx-auto max-w-[1400px] flex flex-col gap-10 md:grid md:grid-cols-2 md:gap-8 lg:flex lg:flex-row lg:justify-between lg:gap-8">
        {linkColumns.map((column) => (
          <div key={column.heading} className="flex flex-col gap-5">
            <h4 className="text-xl font-normal leading-[27.5px] text-[#F1F1F1]">
              {t(column.heading)}
            </h4>
            <ul className="flex flex-col gap-5">
              {column.links.map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="text-sm font-normal leading-[21px] text-[#F1F1F1] hover:text-white"
                  >
                    {t(link)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex flex-col gap-5 md:max-w-[280px]">
          <h4 className="text-xl font-normal leading-[27.5px] text-[#F1F1F1]">
            {t("col5Heading")}
          </h4>
          <ul className="flex flex-col gap-5">
            {showrooms.map((showroom, index) => {
              const isOpen = openShowroom === index;

              return (
                <li key={showroom} className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenShowroom(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm italic leading-[22px] text-white"
                  >
                    <span className="min-w-0 flex-1">{t(showroom)}</span>
                    <ChevronRight
                      className={cn("h-4 w-4 shrink-0", isOpen ? "-rotate-90" : "rotate-90")}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && index === 0 ? (
                    <div className="pl-6 text-sm font-normal leading-[22px] text-[#C1C1C1]">
                      <p>{t("showroom1Address")}</p>
                      <p className="mt-3 italic">{t("showroom1Hours")}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <h4 className="text-xl font-normal leading-[27.5px] text-[#F1F1F1]">
            {t("col6Heading")}
          </h4>
          <ul className="flex flex-col gap-4">
            {contacts.map(({ icon: Icon, key }) => (
              <li key={key} className="text-sm font-normal leading-[21px] text-[#F1F1F1]">
                <IconTextRow iconVariant="inline" icon={<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />} value={t(key)} className="text-[#F1F1F1] [&_span]:text-[#F1F1F1]" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
