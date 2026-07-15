"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { SectionHeader } from "./SectionHeader";
import { FilterSidebar } from "./FilterSidebar";
import { BrandSelector } from "./BrandSelector";
import { SearchBar } from "./SearchBar";
import { ProductGrid } from "./ProductGrid";
import { Pagination } from "./Pagination";
import { useProductListScrollRestoration } from "./use-product-list-scroll-restoration";
import { parseFilters, buildQueryKey, buildQueryString, type CanonicalFilters } from "@/lib/products/filter-utils";
import type { ProductPageData } from "@/lib/products/products-service";

export type BrandOption = { id: string; slug: string; logoUrl: string | null; name: string };
export type CategoryOption = {
  slug: string;
  name: string;
  subCategories: readonly { slug: string; name: string }[];
};
export type RoomOption = { slug: string; label: string };

interface ProductsPageProps {
  brandOptions: readonly BrandOption[];
  categoryOptions: readonly CategoryOption[];
  roomOptions: readonly RoomOption[];
  locale: string;
}

function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ProductsPage({
  brandOptions,
  categoryOptions,
  roomOptions,
  locale,
}: ProductsPageProps) {
  const t = useTranslations("Products");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Parse filters from the URL search params.
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // Sole source of products/counts is useQuery.
  const queryKey = useMemo(() => buildQueryKey(locale, filters), [locale, filters]);
  const { data } = useQuery<ProductPageData>({
    queryKey,
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const res = await fetch(`/api/products?locale=${locale}${qs ? `&${qs}` : ""}`);
      if (!res.ok) {
        throw new Error("Failed to fetch products");
      }
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const products = data?.products ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageSize = 24;

  const selectedBrands = useMemo(() => new Set(filters.brand), [filters.brand]);
  const selectedCategories = useMemo(() => new Set(filters.category), [filters.category]);
  const selectedRooms = useMemo(() => new Set(filters.room), [filters.room]);
  const selectedSubCategories = useMemo(() => new Set(filters.subCategory), [filters.subCategory]);

  const productListScrollKey = useMemo(
    () => `nanohome:products-scroll:${JSON.stringify({
      pathname,
      brand: filters.brand,
      category: filters.category,
      q: filters.q,
      room: filters.room,
      sort: filters.sort,
      status: filters.status,
      subCategory: filters.subCategory,
    })}`,
    [filters, pathname],
  );
  useProductListScrollRestoration(productListScrollKey);

  const brandLabel = useMemo(
    () => new Map(brandOptions.map((brand) => [brand.slug, brand.name])),
    [brandOptions],
  );
  const roomLabel = useMemo(
    () => new Map(roomOptions.map((room) => [room.slug, room.label])),
    [roomOptions],
  );
  const categoryLabel = useMemo(() => {
    const labels = new Map<string, string>();
    for (const category of categoryOptions) {
      labels.set(category.slug, category.name);
      for (const subCategory of category.subCategories) labels.set(subCategory.slug, subCategory.name);
    }
    return labels;
  }, [categoryOptions]);

  const updateUrl = (patch: Partial<CanonicalFilters>) => {
    const nextFilters: CanonicalFilters = {
      ...filters,
      ...patch,
    };
    // Ensure that page defaults back to 1 on filter/search updates unless page is explicitly changed.
    if (patch.page === undefined && (
      patch.brand !== undefined ||
      patch.category !== undefined ||
      patch.subCategory !== undefined ||
      patch.room !== undefined ||
      patch.status !== undefined ||
      patch.q !== undefined ||
      patch.sort !== undefined
    )) {
      nextFilters.page = 1;
    }

    const qs = buildQueryString(nextFilters);
    // native URL pushState, keep scroll false
    const targetUrl = qs ? `${pathname}?${qs}` : pathname;
    window.history.pushState(null, "", targetUrl);
    // Dispatch popstate event so useSearchParams and other hooks react immediately
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  };

  const appliedFilters = useMemo(() => {
    const filterLabels = [
      ...filters.brand.map((slug) => brandLabel.get(slug) ?? slug),
      ...filters.category.map((slug) => categoryLabel.get(slug) ?? slug),
      ...filters.subCategory.map((slug) => categoryLabel.get(slug) ?? slug),
      ...filters.room.map((slug) => roomLabel.get(slug) ?? slug),
    ];
    if (filters.status) filterLabels.push(filters.status);
    if (filters.q.trim()) filterLabels.push(filters.q.trim());
    return filterLabels;
  }, [brandLabel, categoryLabel, filters, roomLabel]);

  const resetFilters = () => {
    window.history.pushState(null, "", pathname);
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    setFiltersOpen(false);
  };

  const removeFilter = (label: string) => {
    const brand = filters.brand.find((slug) => (brandLabel.get(slug) ?? slug) === label);
    if (brand) return updateUrl({ brand: filters.brand.filter((slug) => slug !== brand) });
    const category = filters.category.find((slug) => (categoryLabel.get(slug) ?? slug) === label);
    if (category) return updateUrl({ category: filters.category.filter((slug) => slug !== category) });
    const subCategory = filters.subCategory.find((slug) => (categoryLabel.get(slug) ?? slug) === label);
    if (subCategory) return updateUrl({ subCategory: filters.subCategory.filter((slug) => slug !== subCategory) });
    const room = filters.room.find((slug) => (roomLabel.get(slug) ?? slug) === label);
    if (room) return updateUrl({ room: filters.room.filter((slug) => slug !== room) });
    if (filters.status === label) return updateUrl({ status: null });
    if (filters.q === label) return updateUrl({ q: "" });
  };

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [filtersOpen]);

  return (
    <main className="min-h-screen bg-[#faf9f8] text-nh-ink">
      <SectionHeader
        appliedFilters={appliedFilters}
        onOpenFilters={() => setFiltersOpen(true)}
        onRemoveFilter={removeFilter}
        onResetFilters={resetFilters}
        onSortChange={(sort) => updateUrl({ sort })}
        sortBy={filters.sort}
      />
      {filtersOpen ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("filterDialogLabel")}>
          <div className="h-dvh w-full max-w-[420px] overflow-y-auto bg-white pb-8 shadow-[-12px_0_30px_rgba(0,0,0,0.18)]">
            <div className="sticky top-0 z-30 mb-4 flex flex-col gap-3 border-b border-nh-border bg-white px-4 pb-3 pt-4 sm:px-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-medium uppercase text-nh-ink">{t("filterDialogTitle")}</h2>
                <button className="flex size-11 items-center justify-center" type="button" aria-label={t("closeFilter")} onClick={() => setFiltersOpen(false)}>
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="px-4 sm:px-6">
              <FilterSidebar
                appliedFilters={appliedFilters}
                brandOptions={brandOptions}
                categoryOptions={categoryOptions}
                onRemoveFilter={removeFilter}
                onResetFilters={resetFilters}
                roomOptions={roomOptions}
                selectedBrands={selectedBrands}
                selectedCategories={selectedCategories}
                selectedRooms={selectedRooms}
                selectedStatus={filters.status}
                selectedSubCategories={selectedSubCategories}
                toggleBrand={(brand) => updateUrl({ brand: toggleValue(filters.brand, brand) })}
                toggleCategory={(category) => updateUrl({ category: toggleValue(filters.category, category), subCategory: [] })}
                toggleRoom={(room) => updateUrl({ room: toggleValue(filters.room, room) })}
                toggleStatus={(status) => updateUrl({ status: filters.status === status ? null : status })}
                toggleSubCategory={(subCategory) => updateUrl({ subCategory: toggleValue(filters.subCategory, subCategory) })}
                variant="modal"
              />
            </div>
          </div>
        </div>
      ) : null}
      <div className="site-shell flex flex-col gap-8 pb-8 pt-0">
        <div className="flex flex-col gap-6 pt-3 sm:pt-5 lg:flex-row lg:items-start">
          <FilterSidebar
            brandOptions={brandOptions}
            categoryOptions={categoryOptions}
            roomOptions={roomOptions}
            selectedBrands={selectedBrands}
            selectedCategories={selectedCategories}
            selectedRooms={selectedRooms}
            selectedStatus={filters.status}
            selectedSubCategories={selectedSubCategories}
            toggleBrand={(brand) => updateUrl({ brand: toggleValue(filters.brand, brand) })}
            toggleCategory={(category) => updateUrl({ category: toggleValue(filters.category, category), subCategory: [] })}
            toggleRoom={(room) => updateUrl({ room: toggleValue(filters.room, room) })}
            toggleStatus={(status) => updateUrl({ status: filters.status === status ? null : status })}
            toggleSubCategory={(subCategory) => updateUrl({ subCategory: toggleValue(filters.subCategory, subCategory) })}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <BrandSelector
              brandOptions={brandOptions}
              selectedBrands={selectedBrands}
              toggleBrand={(brand) => updateUrl({ brand: toggleValue(filters.brand, brand) })}
            />
            <SearchBar
              search={filters.q}
              setSearch={(q) => updateUrl({ q })}
            />
            <ProductGrid products={products} />
            <Pagination
              currentPage={filters.page}
              pageSize={pageSize}
              setCurrentPage={(page) => updateUrl({ page })}
              totalCount={totalCount}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
