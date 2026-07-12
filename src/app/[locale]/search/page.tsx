import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchResults } from "@/components/search/search-results";
import { isSupportedLocale } from "@/i18n/routing";
import { searchDesigners } from "@/lib/queries/designers";
import { searchNews } from "@/lib/queries/news";
import { searchProducts } from "@/lib/queries/search";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function queryValue(value: string | readonly string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function SearchPage({ params, searchParams }: Readonly<SearchPageProps>) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Search" });
  const query = queryValue((await searchParams).q);
  const [products, news, designers] = query === ""
    ? [[], [], []] as const
    : await Promise.all([
      searchProducts(query, locale, { page: 1, pageSize: 6 }),
      searchNews(query, locale, { pageSize: 6 }),
      searchDesigners(query, { pageSize: 6 }),
    ]);
  const hasResults = products.length + news.length + designers.length > 0;

  return (
    <main className="bg-nh-surface-warm py-16 text-nh-ink md:py-20">
      <section className="site-shell flex flex-col gap-10">
        <header className="mx-auto flex w-full max-w-3xl flex-col gap-5 text-center">
          <h1 className="text-[32px] font-medium leading-[40px] md:text-[40px] md:leading-[48px]">{t("title")}</h1>
          <form action={`/${locale}/search`} className="flex w-full border border-nh-border bg-nh-surface-primary p-1 text-left sm:w-auto">
            <label className="sr-only" htmlFor="site-search">{t("label")}</label>
            <input id="site-search" name="q" defaultValue={query} placeholder={t("placeholder")} className="min-w-0 flex-1 bg-transparent px-2 sm:px-3 py-2 text-[14px] leading-[22px] outline-none placeholder:text-nh-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent" />
            <button type="submit" className="bg-nh-ink px-4 sm:px-5 py-2 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-colors duration-150 ease-out hover:bg-nh-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent whitespace-nowrap">{t("submit")}</button>
          </form>
          {query === "" ? <p className="text-[14px] leading-[22px] text-nh-muted">{t("prompt")}</p> : <p aria-live="polite" className="text-[14px] leading-[22px] text-nh-muted">{t("summary", { query })}</p>}
        </header>

        {query !== "" ? <>
          {!hasResults ? <p className="text-center text-[14px] leading-[22px] text-nh-muted">{t("noResults")}</p> : null}
          <SearchResults
            copy={{
              designerImageAlt: (values) => t("designerImageAlt", values),
              designers: t("designers"),
              emptyDesigners: t("emptyDesigners"),
              emptyNews: t("emptyNews"),
              emptyProducts: t("emptyProducts"),
              news: t("news"),
              newsImageAlt: (values) => t("newsImageAlt", values),
              productImageAlt: (values) => t("productImageAlt", values),
              products: t("products"),
            }}
            designers={designers}
            locale={locale}
            news={news}
            products={products}
            query={query}
          />
        </> : null}
      </section>
    </main>
  );
}
