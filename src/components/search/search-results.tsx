import type { ReactNode } from "react";

import Image from "next/image";

import { ImageFrame, detailSlug, textValue } from "@/components/editorial/shared";
import { SearchProductGrid } from "@/components/search/search-product-grid";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { localizedText } from "@/lib/i18n/content";
import { localizedRawString } from "@/lib/queries/notion";
import type { UnifiedSearchResults } from "@/lib/queries/unified-search";

import { highlightText } from "./highlight-text";

type SearchCopy = Readonly<{
  brands: string;
  categories: string;
  designers: string;
  emptyBrands: string;
  emptyCategories: string;
  emptyDesigners: string;
  emptyNews: string;
  emptyProducts: string;
  news: string;
  products: string;
  sectionUnavailable: string;
  viewAll: string;
}>;

type SectionProps = Readonly<{
  children: ReactNode;
  errorText: string;
  hasError: boolean;
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}>;

function HighlightedText({ text, query }: Readonly<{ readonly query: string; readonly text: string }>) {
  return highlightText(text, query).map((part, index) => part.matched ? (
    <mark key={`${part.value}-${index}`} className="bg-nh-highlight px-0.5 text-inherit">{part.value}</mark>
  ) : part.value);
}

function SearchSection({ children, errorText, hasError, title, viewAllHref, viewAllLabel }: SectionProps) {
  const sectionId = `search-${title.toLowerCase().replace(/\s+/gu, "-")}`;
  return (
    <section aria-labelledby={sectionId} className="border-t border-nh-border pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={sectionId} className="text-[24px] font-medium leading-8 text-nh-ink">{title}</h2>
        {viewAllHref && viewAllLabel ? <Link href={viewAllHref} className="text-[12px] font-medium uppercase tracking-[0.08em] text-nh-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent">{viewAllLabel}</Link> : null}
      </div>
      {hasError ? <p className="mt-5 text-[14px] leading-[22px] text-nh-muted">{errorText}</p> : children}
    </section>
  );
}

function localizedCategoryName(category: UnifiedSearchResults["categories"]["items"][number], locale: Locale): string {
  return localizedText({ en: category.name, ko: category.name_ko, vi: category.name_vi }, locale, category.name);
}

export function SearchResults({ copy, locale, results }: Readonly<{
  readonly copy: SearchCopy;
  readonly locale: Locale;
  readonly results: UnifiedSearchResults;
}>) {
  const { query } = results;
  const productsHref = `/products?q=${encodeURIComponent(query)}`;

  return (
    <div className="flex flex-col gap-12">
      <SearchSection title={copy.products} errorText={copy.sectionUnavailable} hasError={results.products.hasError} viewAllHref={productsHref} viewAllLabel={copy.viewAll}>
        {results.products.items.length > 0 ? <div className="mt-6"><SearchProductGrid locale={locale} variants={results.products.items} /></div> : <p className="mt-5 text-[14px] leading-[22px] text-nh-muted">{copy.emptyProducts}</p>}
      </SearchSection>

      <SearchSection title={copy.brands} errorText={copy.sectionUnavailable} hasError={results.brands.hasError}>
        {results.brands.items.length > 0 ? <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{results.brands.items.map((brand) => {
          const name = textValue(brand.name, "");
          const id = textValue(brand.airtable_id, brand.id);
          const href = `/brands/${encodeURIComponent(id)}/${detailSlug(brand.slug, brand.id)}`;
          const isUsm = brand.slug === "usm";
          const isVolta = brand.slug === "volta";
          const logoSrc = isUsm ? "/images/usm_logo.png" : brand.logo_url;
          const useFilter = !isUsm && !isVolta;
          return (
            <li key={brand.id} data-search-result="brand" className="min-w-0">
              <Link href={href} aria-label={name} className={`flex aspect-[4/3] items-center justify-center border border-nh-border ${isUsm || isVolta ? "bg-white" : "bg-[#F5F3F0]"} p-6 transition-colors hover:border-nh-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent`}>
                {logoSrc ? (
                  <Image
                    alt={name}
                    className={`h-full w-full object-contain ${useFilter ? "grayscale contrast-200 brightness-0" : ""}`}
                    height={120}
                    width={180}
                    src={logoSrc}
                  />
                ) : (
                  <span className="text-center text-[14px] font-medium leading-5 text-nh-ink">
                    <HighlightedText text={name} query={query} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}</ul> : <p className="mt-5 text-[14px] leading-[22px] text-nh-muted">{copy.emptyBrands}</p>}
      </SearchSection>

      <SearchSection title={copy.categories} errorText={copy.sectionUnavailable} hasError={results.categories.hasError}>
        {results.categories.items.length > 0 ? <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.categories.items.map((category) => {
          const name = localizedCategoryName(category, locale);
          return <li key={category.id} data-search-result="category"><Link href={`/products?category=${encodeURIComponent(textValue(category.slug, category.id))}`} className="text-[16px] leading-6 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent"><HighlightedText text={name} query={query} /></Link></li>;
        })}</ul> : <p className="mt-5 text-[14px] leading-[22px] text-nh-muted">{copy.emptyCategories}</p>}
      </SearchSection>

      <SearchSection title={copy.news} errorText={copy.sectionUnavailable} hasError={results.news.hasError}>
        {results.news.items.length > 0 ? <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{results.news.items.map((item) => {
          const title = localizedText({ en: item.title, ko: item.title_ko, vi: item.title_vi }, locale, item.title);
          return <article key={item.id} data-search-result="news" className="group min-w-0"><Link href={`/news/${encodeURIComponent(textValue(item.airtable_id, item.id))}/${detailSlug(item.slug, item.id)}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent"><ImageFrame src={item.cover_url} alt={title} ratio="aspect-[432/260]" /><h3 className="mt-4 text-[18px] font-medium leading-7 text-nh-ink"><HighlightedText text={title} query={query} /></h3></Link></article>;
        })}</div> : <p className="mt-5 text-[14px] leading-[22px] text-nh-muted">{copy.emptyNews}</p>}
      </SearchSection>

      <SearchSection title={copy.designers} errorText={copy.sectionUnavailable} hasError={results.designers.hasError}>
        {results.designers.items.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">{results.designers.items.map((designer) => {
          const name = textValue(designer.name, "");
          const portrait = localizedRawString(designer.raw, "cldr_portrait", "cldr_portrait", locale) ?? designer.portrait_url;
          return <article key={designer.id} data-search-result="designer" className="group min-w-0 text-center"><Link href={`/designers/${encodeURIComponent(textValue(designer.airtable_id, designer.id))}/${detailSlug(designer.slug, designer.id)}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent"><ImageFrame src={portrait} alt={name} ratio="aspect-[204/260]" className="grayscale" /><h3 className="mt-4 text-[14px] font-normal leading-[22px] text-nh-ink"><HighlightedText text={name} query={query} /></h3></Link></article>;
        })}</div> : <p className="mt-5 text-[14px] leading-[22px] text-nh-muted">{copy.emptyDesigners}</p>}
      </SearchSection>
    </div>
  );
}
