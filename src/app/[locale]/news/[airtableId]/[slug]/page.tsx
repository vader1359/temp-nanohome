import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImageFrame, formatDate, safeDecodeURIComponent, textValue } from "@/components/editorial/shared";
import { NotionArticle } from "@/components/editorial/notion-article";
import { getNewsByAirtableId } from "@/lib/queries/news";
import { extractNotionPageId, getNotionRecordMap, localizedNewsDescription, localizedNotionLink } from "@/lib/queries/notion";

export default async function NewsDetailPage({ params }: Readonly<{ params: Promise<{ locale: string; airtableId: string; slug: string }> }>) {
  const { locale, airtableId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "News" });
  const decodedAirtableId = safeDecodeURIComponent(airtableId);

  if (decodedAirtableId === null) {
    notFound();
  }

  const news = await getNewsByAirtableId(decodedAirtableId);

  if (news === null) {
    notFound();
  }

  const title = textValue(locale === "vi" ? news.title_vi : news.title, textValue(locale === "vi" ? news.title : news.title_vi, t("fallbackTitle")));
  const description = localizedNewsDescription(news.raw, news.description, locale);
  const notionLink = localizedNotionLink(news.raw, locale) ?? news.notion_url;
  const notionPageId = extractNotionPageId(notionLink);
  const recordMap = notionPageId === null ? null : await getNotionRecordMap(notionPageId);

  return (
    <main className="bg-[#faf9f8] pb-24 text-nh-ink">
      <article className="mx-auto flex max-w-[1116px] flex-col gap-10 px-4 py-20 sm:px-6 lg:px-0">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[12px] leading-[18px] text-nh-muted">{t("metaLabel")} · {formatDate(news.source_created_at, locale)}</p>
          <h1 className="mt-5 text-[32px] font-medium leading-[40px] md:text-[40px] md:leading-[48px]">{title}</h1>
          {description ? <p className="mt-5 text-[14px] leading-[22px] text-nh-muted">{description}</p> : null}
        </header>
        <ImageFrame src={news.cover_url} alt={title} ratio="aspect-[1360/615]" />
        {recordMap ? <NotionArticle recordMap={recordMap} /> : <p className="mx-auto max-w-3xl text-[16px] leading-7 text-nh-ink">{textValue(description, t("fallbackBody"))}</p>}
      </article>
    </main>
  );
}
