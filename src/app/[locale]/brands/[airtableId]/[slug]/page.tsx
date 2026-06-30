import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NotionArticle } from "@/components/editorial/notion-article";
import { ProductStrip, safeDecodeURIComponent, textValue } from "@/components/editorial/shared";
import { getBrandByAirtableId, getProductsByBrandAirtableId } from "@/lib/queries/brands";
import { extractNotionPageId, getNotionRecordMap, localizedNotionLink } from "@/lib/queries/notion";

export default async function BrandDetailPage({ params }: Readonly<{ params: Promise<{ locale: string; airtableId: string; slug: string }> }>) {
  const { locale, airtableId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Brands" });
  const staticT = await getTranslations({ locale, namespace: "Static" });
  const decodedAirtableId = safeDecodeURIComponent(airtableId);

  if (decodedAirtableId === null) {
    notFound();
  }

  const brand = await getBrandByAirtableId(decodedAirtableId);

  if (brand === null) {
    notFound();
  }

  const products = await getProductsByBrandAirtableId(textValue(brand.airtable_id, brand.id), { pageSize: 3 });
  const name = textValue(brand.name, t("fallbackName"));
  const description = textValue(locale === "vi" ? brand.description_vi : brand.description, textValue(locale === "vi" ? brand.description : brand.description_vi, t("fallbackDescription")));
  const origin = textValue(locale === "vi" ? brand.origin_vi : brand.origin, textValue(locale === "vi" ? brand.origin : brand.origin_vi));
  const notionLink = localizedNotionLink(brand.raw, locale);
  const notionPageId = extractNotionPageId(notionLink);
  const recordMap = notionPageId === null ? null : await getNotionRecordMap(notionPageId);

  return (
    <main className="bg-[#faf9f8] pb-24 text-nh-ink">
      <section className="mx-auto grid max-w-[1116px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-0">
        <div className="flex aspect-[204/160] items-center justify-center bg-[#e1e1e1] p-12">
          {brand.logo_url ? <img src={brand.logo_url} alt={name} className="max-h-20 max-w-full object-contain grayscale contrast-200 brightness-0" /> : <span className="text-center text-[24px] font-medium leading-8">{name}</span>}
        </div>
        <article className="flex flex-col justify-center">
          <p className="text-[14px] font-medium uppercase leading-5 tracking-[0.08em] text-nh-muted">{t("detailLabel")}</p>
          <h1 className="mt-5 text-[32px] font-medium leading-[40px] md:text-[40px] md:leading-[48px]">{name}</h1>
          <p className="mt-3 text-[14px] leading-[22px] text-nh-muted">{origin}</p>
          <p className="mt-6 whitespace-pre-line text-[14px] leading-[22px] text-nh-muted">{description}</p>
        </article>
      </section>
      {recordMap ? <NotionArticle recordMap={recordMap} /> : null}
      <ProductStrip products={products} title={staticT("relatedProducts")} fallbackProductName={staticT("fallbackProduct")} fallbackProductDescription={staticT("fallbackProductDescription")} />
    </main>
  );
}
