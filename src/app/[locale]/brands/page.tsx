import { getTranslations, setRequestLocale } from "next-intl/server";
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
                <Link href={`/brands/${encodeURIComponent(textValue(brand.airtable_id, brand.id))}/${detailSlug(brand.slug, brand.id)}`} className="flex aspect-[204/160] items-center justify-center bg-[#e1e1e1] p-8 transition-opacity duration-300 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
                  {brand.logo_url ? <img src={brand.logo_url} alt={name} className="max-h-16 max-w-full object-contain grayscale contrast-200 brightness-0" /> : <span className="text-center text-[14px] font-medium leading-[22px] text-nh-ink">{name}</span>}
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
