import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ImageFrame, ProductStrip, safeDecodeURIComponent, textValue } from "@/components/editorial/shared";
import { getDesignerByAirtableId, getProductsByDesignerAirtableId } from "@/lib/queries/designers";
import { localizedRawString } from "@/lib/queries/notion";

export default async function DesignerDetailPage({ params }: Readonly<{ params: Promise<{ locale: string; airtableId: string; slug: string }> }>) {
  const { locale, airtableId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Designers" });
  const staticT = await getTranslations({ locale, namespace: "Static" });
  const decodedAirtableId = safeDecodeURIComponent(airtableId);

  if (decodedAirtableId === null) {
    notFound();
  }

  const designer = await getDesignerByAirtableId(decodedAirtableId);

  if (designer === null) {
    notFound();
  }

  const products = await getProductsByDesignerAirtableId(textValue(designer.airtable_id, designer.id), { pageSize: 3 });
  const name = textValue(designer.name, t("fallbackName"));
  const portraitUrl = localizedRawString(designer.raw, "cldr_portrait", "cldr_portrait", locale) ?? designer.portrait_url;

  return (
    <main className="bg-[#faf9f8] pb-24 text-nh-ink">
      <section className="mx-auto grid max-w-[1116px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-0">
        <ImageFrame src={portraitUrl} alt={name} ratio="aspect-[204/260]" className="grayscale" />
        <article className="flex flex-col justify-center">
          <p className="text-[14px] font-medium uppercase leading-5 tracking-[0.08em] text-nh-muted">{t("detailLabel")}</p>
          <h1 className="mt-5 text-[32px] font-medium leading-[40px] md:text-[40px] md:leading-[48px]">{name}</h1>
          <p className="mt-6 whitespace-pre-line text-[14px] leading-[22px] text-nh-muted">{textValue(designer.description, t("fallbackDescription"))}</p>
        </article>
      </section>
      <ProductStrip products={products} title={staticT("relatedProducts")} fallbackProductName={staticT("fallbackProduct")} fallbackProductDescription={staticT("fallbackProductDescription")} />
    </main>
  );
}
