import { Download } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EditorialHeader, SectionTitleLink, textValue } from "@/components/editorial/shared";
import { catalogFileUrl } from "@/lib/queries/catalog-url";
import { getCatalogs } from "@/lib/queries/catalogs";

type CatalogGroup = {
  readonly brandName: string;
  readonly catalogs: Awaited<ReturnType<typeof getCatalogs>>;
};

function groupCatalogs(catalogs: Awaited<ReturnType<typeof getCatalogs>>): readonly CatalogGroup[] {
  const groups = new Map<string, Awaited<ReturnType<typeof getCatalogs>>>();

  for (const catalog of catalogs) {
    const brandName = textValue(catalog.brand_name, "nanoHome");
    const existing = groups.get(brandName) ?? [];
    groups.set(brandName, [...existing, catalog]);
  }

  return Array.from(groups.entries()).map(([brandName, groupedCatalogs]) => ({ brandName, catalogs: groupedCatalogs }));
}

export default async function CatalogsPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Catalogs" });
  const catalogs = await getCatalogs();
  const groups = groupCatalogs(catalogs);

  return (
    <main className="bg-[#faf9f8] text-nh-ink">
      <section className="mx-auto flex max-w-[1344px] flex-col gap-[60px] px-4 py-20 sm:px-6 lg:px-12">
        <EditorialHeader title={t("title")} description={t("description")} />
        <div className="flex flex-col gap-[72px]">
          {groups.map((group) => (
            <section key={group.brandName} className="flex flex-col gap-8">
              <SectionTitleLink title={group.brandName} />
              <div className="grid gap-6 md:grid-cols-3">
                {group.catalogs.map((catalog) => {
                  const primaryFile = catalog.file_urls.map(catalogFileUrl).find((url) => url !== null) ?? null;
                  return (
                    <article key={catalog.id} className="bg-white p-6">
                      <div className="flex aspect-[432/260] items-center justify-center bg-[#e1e1e1] p-8">
                        <span className="text-center text-[24px] font-medium leading-8 text-nh-ink">{group.brandName}</span>
                      </div>
                      <h2 className="mt-5 text-[18px] font-medium leading-7 text-nh-ink">{group.brandName} Catalog</h2>
                       <p className="mt-2 text-[14px] leading-[22px] text-nh-muted">{textValue(catalog.origin_vi, textValue(catalog.origin, t("fallbackOrigin")))}</p>
                      {primaryFile ? (
                        <a href={primaryFile} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-[14px] font-medium leading-[22px] text-nh-accent hover:text-nh-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nh-accent">
                          {t("download")}
                          <Download className="size-4" aria-hidden="true" />
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
