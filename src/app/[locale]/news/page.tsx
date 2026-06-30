import { getTranslations, setRequestLocale } from "next-intl/server";
import { EditorialHeader, ListingCard, SectionTitleLink, detailSlug, formatDate, textValue, type ListingCardItem } from "@/components/editorial/shared";
import { getNewsList } from "@/lib/queries/news";
import { localizedNewsDescription } from "@/lib/queries/notion";
import type { News } from "@/types/db";

const categoryKeys = ["categoryAll", "categoryProducts", "categoryBrands", "categoryProjects", "categoryHomes", "categoryServices", "categoryEvents", "categoryCulture"] as const;
const sectionTitleKeys = ["categoryProducts", "categoryBrands", "categoryProjects", "categoryHomes", "categoryServices", "categoryEvents", "categoryCulture"] as const;

function newsTitle(news: News, locale: string, fallbackTitle: string): string {
  return textValue(locale === "vi" ? news.title_vi : news.title, textValue(locale === "vi" ? news.title : news.title_vi, fallbackTitle));
}

function newsDescription(news: News, locale: string): string | null {
  return localizedNewsDescription(news.raw, news.description, locale);
}

function newsCard(news: News, locale: string, metaLabel: string, fallbackTitle: string): ListingCardItem {
  return {
    href: `/news/${encodeURIComponent(textValue(news.airtable_id, news.id))}/${detailSlug(news.slug, news.id)}`,
    imageUrl: news.cover_url,
    title: newsTitle(news, locale, fallbackTitle),
    meta: `${metaLabel} · ${formatDate(news.source_created_at, locale)}`,
    description: newsDescription(news, locale),
  };
}

export default async function NewsPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "News" });
  const news = await getNewsList(1, 24);
  const [feature, ...rest] = news;
  const sideItems = rest.slice(0, 5);
  const gridItems = rest.slice(5);

  return (
    <main className="bg-[#faf9f8] text-nh-ink">
      <section className="mx-auto flex max-w-[1344px] flex-col gap-[60px] px-4 py-20 sm:px-6 lg:px-12">
        <EditorialHeader title={t("title")} description={t("description")} />
        <nav className="mx-auto flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-3 text-[14px] leading-[22px] text-nh-muted" aria-label="News categories">
          {categoryKeys.map((category) => (
            <span key={category} className="first:text-nh-ink">{t(category)}</span>
          ))}
        </nav>

        {feature ? (
          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <ListingCard item={newsCard(feature, locale, t("metaLabel"), t("fallbackTitle"))} feature />
            <div className="flex flex-col gap-6">
              {sideItems.map((item) => (
                <ListingCard key={item.id} item={newsCard(item, locale, t("metaLabel"), t("fallbackTitle"))} compact />
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-[72px]">
          {sectionTitleKeys.map((titleKey, sectionIndex) => {
            const offset = sectionIndex * 3;
            const items = gridItems.slice(offset, offset + 3);
            if (items.length === 0) {
              return null;
            }

            return (
              <section key={titleKey} className="flex flex-col gap-8">
                <SectionTitleLink title={t(titleKey)} href="/news" />
                <div className="grid gap-6 md:grid-cols-3">
                  {items.map((item) => (
                    <ListingCard key={item.id} item={newsCard(item, locale, t("metaLabel"), t("fallbackTitle"))} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
