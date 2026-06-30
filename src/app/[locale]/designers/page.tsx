import { getTranslations, setRequestLocale } from "next-intl/server";
import { EditorialHeader, ImageFrame, detailSlug, textValue } from "@/components/editorial/shared";
import { Link } from "@/i18n/navigation";
import { getDesigners } from "@/lib/queries/designers";
import { localizedRawString } from "@/lib/queries/notion";

export default async function DesignersPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Designers" });
  const designers = await getDesigners();

  return (
    <main className="bg-[#faf9f8] text-nh-ink">
      <section className="mx-auto flex max-w-[1344px] flex-col gap-[60px] px-4 py-20 sm:px-6 lg:px-12">
        <EditorialHeader title={t("title")} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-[60px] sm:grid-cols-3 lg:grid-cols-6">
          {designers.map((designer) => {
            const name = textValue(designer.name, t("fallbackName"));
            const portraitUrl = localizedRawString(designer.raw, "cldr_portrait", "cldr_portrait", locale) ?? designer.portrait_url;
            return (
              <article key={designer.id} className="group text-center">
                <Link href={`/designers/${encodeURIComponent(textValue(designer.airtable_id, designer.id))}/${detailSlug(designer.slug, designer.id)}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
                  <ImageFrame src={portraitUrl} alt={name} ratio="aspect-[204/260]" className="grayscale" />
                  <h2 className="mt-4 text-[14px] font-normal leading-[22px] text-nh-ink">{name}</h2>
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
