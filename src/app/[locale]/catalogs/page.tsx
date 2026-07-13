import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogGroup, type CatalogCardItem } from "@/components/catalogs/catalog-group";
import { EditorialHeader, textValue } from "@/components/editorial/shared";
import { isSupportedLocale, type Locale } from "@/i18n/routing";
import { localizedText } from "@/lib/i18n/content";
import { catalogFileUrl } from "@/lib/queries/catalog-url";
import { getBrands } from "@/lib/queries/brands";
import { getCatalogs } from "@/lib/queries/catalogs";

type CatalogGroupData = {
  readonly brandName: string;
  readonly cards: readonly CatalogCardItem[];
  readonly logoUrl: string | null;
};

function groupCatalogs(
  catalogs: Awaited<ReturnType<typeof getCatalogs>>,
  brands: Awaited<ReturnType<typeof getBrands>>,
  locale: Locale,
  fallbackOrigin: string,
): readonly CatalogGroupData[] {
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const groups = new Map<string, CatalogGroupData>();

  for (const catalog of catalogs) {
    const brand = catalog.brand_id === null ? undefined : brandById.get(catalog.brand_id);
    const brandName = brand?.name ?? textValue(catalog.brand_name, "nanoHome");
    const groupKey = brand?.id ?? brandName;
    const existing = groups.get(groupKey) ?? { brandName, cards: [], logoUrl: brand?.logo_url ?? null };
    const origin = localizedText({ ko: catalog.origin_ko, vi: catalog.origin_vi, en: catalog.origin }, locale, fallbackOrigin);
    const cards = catalog.file_urls
      .map(catalogFileUrl)
      .filter((url): url is string => url !== null)
      .map((url, index) => ({ id: `${catalog.id}-${url}`, origin, title: `${brandName} Catalog ${index + 1}`, url }));

    groups.set(groupKey, { ...existing, cards: [...existing.cards, ...cards] });
  }

  return Array.from(groups.values()).filter((group) => group.cards.length > 0);
}

export default async function CatalogsPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Catalogs" });
  const [brands, catalogs] = await Promise.all([getBrands(), getCatalogs()]);
  const groups = groupCatalogs(catalogs, brands, locale, t("fallbackOrigin"));

  return (
    <main className="bg-[#faf9f8] text-nh-ink">
      <section className="mx-auto flex max-w-[1344px] flex-col gap-[60px] px-4 py-20 sm:px-6 lg:px-12">
        <EditorialHeader title={t("title")} description={t("description")} />
        <div className="flex flex-col gap-[72px]">
          {groups.map((group) => <CatalogGroup key={group.brandName} {...group} downloadLabel={t("download")} />)}
        </div>
      </section>
    </main>
  );
}
