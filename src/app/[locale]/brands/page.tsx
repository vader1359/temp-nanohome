import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GlareHover } from "@/components/animations/glare-hover";
import { EditorialHeader, detailSlug, textValue } from "@/components/editorial/shared";
import { Link } from "@/i18n/navigation";
import { getBrands } from "@/lib/queries/brands";

export default async function BrandsPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Brands" });
  const brands = await getBrands();

  return (
    <main className="bg-[#faf9f8] text-nh-ink">
      <section className="mx-auto flex max-w-[1116px] flex-col gap-[60px] px-4 py-20 sm:px-6 lg:px-0">
        <EditorialHeader title={t("title")} description={t("description")} />
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {brands.map((brand) => {
            const name = textValue(brand.name, t("fallbackName"));
            return (
              <article key={brand.id} className="group">
                <GlareHover className="aspect-[204/160] bg-[#e1e1e1]">
                  <Link href={`/brands/${encodeURIComponent(textValue(brand.airtable_id, brand.id))}/${detailSlug(brand.slug, brand.id)}`} className="relative flex h-full w-full items-center justify-center p-10 transition-opacity duration-300 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
                    {brand.logo_url ? <div className="relative h-full w-full"><Image src={brand.logo_url} alt={name} fill sizes="(min-width: 1024px) 204px, (min-width: 640px) 33vw, 50vw" className="object-contain grayscale contrast-200 brightness-0" /></div> : <span className="text-center text-[14px] font-medium leading-[22px] text-nh-ink">{name}</span>}
                  </Link>
                </GlareHover>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
