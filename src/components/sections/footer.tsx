"use client";

import { ChevronRight, Globe, Mail, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const socialLinks = [
  {
    key: "socialFacebook",
    href: "https://www.facebook.com/nanohome.gallery",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    key: "socialInstagram",
    href: "https://www.instagram.com/nanohome_gallery",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    ),
  },
  {
    key: "socialTiktok",
    href: "https://www.tiktok.com/@nanohomegallery",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
      </svg>
    ),
  },
] as const;

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
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(220px,1.4fr)] lg:gap-x-8 lg:gap-y-12">
          {linkColumns.map((column) => (
            <nav key={column.heading} aria-label={t(column.heading)} className="flex flex-col gap-4">
              <h4 className="text-sm font-medium uppercase tracking-[0.08em] text-white">
                {t(column.heading)}
              </h4>
              <ul className="flex flex-col gap-3">
                {column.links.map((link) => {
                  const label = t(link);
                  const isComingSoon = label.toLowerCase().includes("coming soon");
                  return (
                    <li key={link}>
                      {isComingSoon ? (
                        <span className="text-sm leading-[20px] text-[#666666] cursor-not-allowed select-none">
                          {label}
                        </span>
                      ) : (
                        <Link
                          href={footerLinkHref(link)}
                          className="text-sm leading-[20px] text-[#C9C9C9] transition-colors duration-150 ease-out hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                        >
                          {label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}

          <section className="col-span-2 flex min-w-0 flex-col gap-4 md:col-span-1 lg:col-span-1" aria-labelledby="footer-showrooms">
            <h4 id="footer-showrooms" className="text-sm font-medium uppercase tracking-[0.08em] text-white">
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
                      className="flex w-full items-center justify-between gap-2 text-left text-sm leading-[20px] text-[#E7E7E7] transition-colors duration-150 ease-out hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      <span className="min-w-0 flex-1 font-semibold">{t(showroom)}</span>
                      <ChevronRight
                        className={cn("size-3.5 shrink-0 transition-transform duration-150 ease-out", isOpen ? "-rotate-90" : "rotate-90")}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen ? (
                      <div id={detailsId} className="text-sm leading-[20px] text-[#AFAFAF]">
                        <p>{t(`${showroom}Address`)}</p>
                        {t(`${showroom}Hours`) ? (
                          <p className="mt-2">{t(`${showroom}Hours`)}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

        </div>

        {/* Bottom bar — contact info + social networks */}
        <div className="mt-12 flex flex-col gap-6 border-t border-white/15 pt-5 md:mt-16 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 text-sm leading-[20px] text-[#AFAFAF] sm:flex-row sm:gap-6">
            <a href="https://www.nanohome.vn" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white w-fit">
              <Globe className="size-3.5 shrink-0" aria-hidden="true" />
              www.nanohome.vn
            </a>
            <a href="tel:+84339487632" className="flex items-center gap-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white w-fit">
              <Phone className="size-3.5 shrink-0" aria-hidden="true" />
              {t("phone")}
            </a>
            <a href="mailto:info@nanohome.vn" className="flex items-center gap-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white w-fit">
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              {t("email")}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm leading-[20px] text-[#AFAFAF]">{t("followUs")}</span>
            {socialLinks.map(({ key, href, icon }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t(key)}
                className="text-[#C9C9C9] transition-colors duration-150 ease-out hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
