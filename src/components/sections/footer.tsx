"use client";

import { ChevronRight, Globe, Mail, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const socialLinks = [
  {
    key: "socialFacebook",
    href: "https://www.facebook.com/nanohome.vn",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    ),
  },
  {
    key: "socialInstagram",
    href: "https://www.instagram.com/nanohome.vn",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    key: "socialYoutube",
    href: "https://www.youtube.com/@nanohome",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    key: "socialTiktok",
    href: "https://www.tiktok.com/@nanohome",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
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

        </div>

        {/* Bottom bar — contact info + social networks */}
        <div className="mt-12 flex flex-col gap-6 border-t border-white/15 pt-5 md:mt-16 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 text-xs leading-[18px] text-[#AFAFAF] sm:flex-row sm:gap-6">
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
            <span className="text-xs leading-[18px] text-[#AFAFAF]">{t("followUs")}</span>
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
