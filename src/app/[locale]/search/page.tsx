import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SearchResults } from "@/components/search/search-results";
import { isSupportedLocale } from "@/i18n/routing";
import { unifiedSearch } from "@/lib/queries/unified-search";

interface SearchPageProps {
  readonly params: Promise<{ readonly locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function searchQuery(value: string | readonly string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Search" });
  const results = await unifiedSearch(searchQuery((await searchParams).q), locale);
  const hasResults =
    results.products.items.length +
    results.brands.items.length +
    results.categories.items.length +
    results.designers.items.length +
    results.news.items.length > 0;

  return (
    <main className="bg-nh-surface-warm py-16 text-nh-ink md:py-20">
      <section className="site-shell flex flex-col gap-10">
        <header className="mx-auto flex w-full max-w-3xl flex-col gap-5 text-center">
          <h1 className="text-[32px] font-medium leading-[40px] md:text-[40px] md:leading-[48px]">{t("title")}</h1>
          <form action={`/${locale}/search`} className="flex border border-nh-border bg-nh-surface-primary p-1 text-left">
            <label className="sr-only" htmlFor="site-search">{t("label")}</label>
            <input id="site-search" name="q" defaultValue={results.query} placeholder={t("placeholder")} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] leading-[22px] outline-none placeholder:text-nh-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" />
            <button type="submit" className="bg-nh-ink px-5 py-2 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-colors duration-150 ease-out hover:bg-nh-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent">{t("submit")}</button>
          </form>
          {results.query === "" ? <p className="text-[14px] leading-[22px] text-nh-muted">{t("prompt")}</p> : <p aria-live="polite" className="text-[14px] leading-[22px] text-nh-muted">{t("summary", { query: results.query })}</p>}
        </header>

        {results.query !== "" ? <>
          {!hasResults ? <p className="text-center text-[14px] leading-[22px] text-nh-muted">{t("noResults")}</p> : null}
          <SearchResults
            copy={{
              brands: t("brands"),
              categories: t("categories"),
              designers: t("designers"),
              emptyBrands: t("emptyBrands"),
              emptyCategories: t("emptyCategories"),
              emptyDesigners: t("emptyDesigners"),
              emptyNews: t("emptyNews"),
              emptyProducts: t("emptyProducts"),
              news: t("news"),
              products: t("products"),
              sectionUnavailable: t("sectionUnavailable"),
              viewAll: t("viewAll"),
            }}
            locale={locale}
            results={results}
          />
        </> : null}
      </section>
    </main>
  );
}
