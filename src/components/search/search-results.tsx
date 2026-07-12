import type { ReactNode } from "react";
import { ImageFrame, detailSlug, textValue } from "@/components/editorial/shared";
import { Link } from "@/i18n/navigation";
import { localizedText } from "@/lib/i18n/content";
import { firstCloudinaryImage } from "@/lib/image";
import { localizedNewsDescription, localizedRawString } from "@/lib/queries/notion";
import type { Locale } from "@/i18n/routing";
import type { Designer, News, Product } from "@/types/db";

import { highlightText } from "./highlight-text";

type SearchCopy = Readonly<{
  designerImageAlt: (values: { readonly name: string }) => string;
  designers: string;
  emptyDesigners: string;
  emptyNews: string;
  emptyProducts: string;
  news: string;
  newsImageAlt: (values: { readonly title: string }) => string;
  productImageAlt: (values: { readonly name: string }) => string;
  products: string;
}>;

function HighlightedText({ text, query }: Readonly<{ query: string; text: string }>) {
  return highlightText(text, query).map((part, index) => part.matched ? (
    <mark key={`${part.value}-${index}`} className="bg-nh-highlight px-0.5 text-inherit">{part.value}</mark>
  ) : part.value);
}

function SearchSection({ children, empty, title }: Readonly<{ children: ReactNode; empty: string; title: string }>) {
  return (
    <section aria-labelledby={`search-${title}`} className="border-t border-nh-border pt-6">
      <h2 id={`search-${title}`} className="text-[24px] font-medium leading-8 text-nh-ink">{title}</h2>
      {children}
      <p className="mt-5 text-[14px] leading-[22px] text-nh-muted empty:hidden">{empty}</p>
    </section>
  );
}

export function SearchResults({
  copy,
  designers,
  locale,
  news,
  products,
  query,
}: Readonly<{
  copy: SearchCopy;
  designers: readonly Designer[];
  locale: Locale;
  news: readonly News[];
  products: readonly Product[];
  query: string;
}>) {
  const visibleNews = locale === "ko" ? news.filter((item) => textValue(item.title_ko) !== "") : news;

  return (
    <div className="flex flex-col gap-12">
      <SearchSection title={copy.products} empty={products.length === 0 ? copy.emptyProducts : ""}>
        {products.length > 0 ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const name = localizedText({ en: product.name, ko: product.name_ko, vi: product.name_vi }, locale, product.name);
            const description = localizedText({ en: product.description, ko: product.description_ko, vi: product.description_vi }, locale);
            return <article key={product.id} className="group min-w-0 bg-nh-surface-primary p-4">
              <Link href={`/products/${detailSlug(product.slug, product.id)}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
                <ImageFrame src={firstCloudinaryImage([product.media_image_url])} alt={copy.productImageAlt({ name })} ratio="aspect-[4/3]" />
                <h3 className="mt-4 text-[18px] font-medium leading-7 text-nh-ink"><HighlightedText text={name} query={query} /></h3>
                {description ? <p className="mt-2 line-clamp-2 text-[14px] leading-[22px] text-nh-muted"><HighlightedText text={description} query={query} /></p> : null}
              </Link>
            </article>;
          })}
        </div> : null}
      </SearchSection>

      <SearchSection title={copy.news} empty={visibleNews.length === 0 ? copy.emptyNews : ""}>
        {visibleNews.length > 0 ? <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleNews.map((item) => {
            const title = localizedText({ en: item.title, ko: item.title_ko, vi: item.title_vi }, locale, item.title);
            const description = locale === "ko" ? null : localizedNewsDescription(item.raw, item.description, locale);
            return <article key={item.id} className="group min-w-0">
              <Link href={`/news/${encodeURIComponent(textValue(item.airtable_id, item.id))}/${detailSlug(item.slug, item.id)}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
                <ImageFrame src={item.cover_url} alt={copy.newsImageAlt({ title })} ratio="aspect-[432/260]" />
                <h3 className="mt-4 text-[18px] font-medium leading-7 text-nh-ink"><HighlightedText text={title} query={query} /></h3>
                {description ? <p className="mt-2 line-clamp-3 text-[14px] leading-[22px] text-nh-muted"><HighlightedText text={description} query={query} /></p> : null}
              </Link>
            </article>;
          })}
        </div> : null}
      </SearchSection>

      <SearchSection title={copy.designers} empty={designers.length === 0 ? copy.emptyDesigners : ""}>
        {designers.length > 0 ? <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {designers.map((designer) => {
            const name = textValue(designer.name, "");
            const portrait = localizedRawString(designer.raw, "cldr_portrait", "cldr_portrait", locale) ?? designer.portrait_url;
            return <article key={designer.id} className="group min-w-0 text-center">
              <Link href={`/designers/${encodeURIComponent(textValue(designer.airtable_id, designer.id))}/${detailSlug(designer.slug, designer.id)}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
                <ImageFrame src={portrait} alt={copy.designerImageAlt({ name })} ratio="aspect-[204/260]" className="grayscale" />
                <h3 className="mt-4 text-[14px] font-normal leading-[22px] text-nh-ink"><HighlightedText text={name} query={query} /></h3>
              </Link>
            </article>;
          })}
        </div> : null}
      </SearchSection>
    </div>
  );
}
