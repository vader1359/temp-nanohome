"use client";

import { ChevronRight, Globe, Mail, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
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

type FooterLinkKey = (typeof linkColumns)[number]["links"][number];

function footerLinkHref(link: FooterLinkKey): string {
  switch (link) {
    case "col1Link1":
      return "/about-us";
    case "col1Link2":
      return "/about-us";
    case "col1Link3":
      return "/news";
    case "col1Link4":
      return "/news";
    case "col1Link5":
      return "/about-us";
    case "col2Link1":
      return "/products?category=furniture";
    case "col2Link2":
      return "/products?category=lighting";
    case "col3Link1":
      return "/products?brand=usm";
    case "col3Link2":
      return "/products?category=furniture";
    case "col3Link3":
      return "/products?category=lighting";
    case "col3Link4":
      return "/products?subCategory=accessories";
    case "col4Link1":
      return "/brands";
    case "col4Link2":
      return "/designers";
    case "col4Link3":
      return "/news";
    case "col4Link4":
      return "/catalogs";
  }
}

export function Footer() {
  const t = useTranslations("Footer");
  const [openShowroom, setOpenShowroom] = useState<number | null>(0);

  return (
    <footer className="bg-nh-footer py-12 text-[#F1F1F1] md:py-16">
      <div className="site-shell">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(220px,1.4fr)_minmax(180px,1fr)] lg:gap-x-8 lg:gap-y-12">
          {linkColumns.map((column) => (
            <nav key={column.heading} aria-label={t(column.heading)} className="flex flex-col gap-4">
              <h4 className="text-xs font-medium uppercase tracking-[0.08em] text-white">
                {t(column.heading)}
              </h4>
              <ul className="flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <Link
                      href={footerLinkHref(link)}
                      className="text-xs leading-[18px] text-[#C9C9C9] transition-colors duration-150 ease-out hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      {t(link)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <section className="col-span-2 flex min-w-0 flex-col gap-4 md:col-span-1 lg:col-span-1" aria-labelledby="footer-showrooms">
            <h4 id="footer-showrooms" className="text-xs font-medium uppercase tracking-[0.08em] text-white">
              {t("col5Heading")}
            </h4>
            <ul className="flex flex-col gap-3">
              {showrooms.map((showroom, index) => {
                const isOpen = openShowroom === index;
                const detailsId = `showroom-details-${index}`;

                return (
                  <li key={showroom} className="flex flex-col gap-2">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={detailsId}
                      onClick={() => setOpenShowroom(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-2 text-left text-xs leading-[18px] text-[#E7E7E7] transition-colors duration-150 ease-out hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      <span className="min-w-0 flex-1">{t(showroom)}</span>
                      <ChevronRight
                        className={cn("size-3.5 shrink-0 transition-transform duration-150 ease-out", isOpen ? "-rotate-90" : "rotate-90")}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen && index === 0 ? (
                      <div id={detailsId} className="text-xs leading-[18px] text-[#AFAFAF]">
                        <p>{t("showroom1Address")}</p>
                        <p className="mt-2">{t("showroom1Hours")}</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="col-span-2 flex min-w-0 flex-col gap-4 md:col-span-1 lg:col-span-1" aria-labelledby="footer-contact">
            <h4 id="footer-contact" className="text-xs font-medium uppercase tracking-[0.08em] text-white">
              {t("col6Heading")}
            </h4>
            <ul className="flex flex-col gap-3">
              {contacts.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-center gap-2 text-xs leading-[18px] text-[#C9C9C9]">
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{t(key)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="mt-12 border-t border-white/15 pt-5 text-xs leading-[18px] text-[#AFAFAF] md:mt-16">
          {t("website")}
        </div>
      </div>
    </footer>
  );
}
