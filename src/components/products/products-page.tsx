"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SectionHeader } from "./SectionHeader";
import { FilterSidebar } from "./FilterSidebar";
import { BrandSelector } from "./BrandSelector";
import { SearchBar } from "./SearchBar";
import { ProductGrid, type ProductGridItem } from "./ProductGrid";
import { Pagination } from "./Pagination";

export type BrandOption = { id: string; slug: string; logoUrl: string | null; name: string };
export type CategoryOption = {
  slug: string;
  name: string;
  subCategories: readonly { slug: string; name: string }[];
};
export type RoomOption = { slug: string; label: string };
export type SelectedProductFilters = {
  brand: readonly string[];
  category: readonly string[];
  subCategory: readonly string[];
  room: readonly string[];
  status: "in_stock" | "sale" | "out_of_stock" | null;
  q: string;
  sort: "priority" | "price_asc" | "price_desc" | "newest";
  page: number;
};

interface ProductsPageProps {
  brandOptions: readonly BrandOption[];
  categoryOptions: readonly CategoryOption[];
  currentFilters: SelectedProductFilters;
  pageSize: number;
  products: readonly ProductGridItem[];
  roomOptions: readonly RoomOption[];
  totalCount: number;
}

function setMultiParam(params: URLSearchParams, key: string, values: readonly string[]) {
  params.delete(key);
  for (const value of values) {
    if (value.trim() !== "") params.append(key, value);
  }
}

function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ProductsPage({
  brandOptions,
  categoryOptions,
  currentFilters,
  pageSize,
  products,
  roomOptions,
  totalCount,
}: ProductsPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [optimisticFilters, setOptimisticFilters] = useOptimistic(currentFilters);

  const selectedBrands = useMemo(() => new Set(optimisticFilters.brand), [optimisticFilters.brand]);
  const selectedCategories = useMemo(() => new Set(optimisticFilters.category), [optimisticFilters.category]);
  const selectedRooms = useMemo(() => new Set(optimisticFilters.room), [optimisticFilters.room]);
  const selectedSubCategories = useMemo(() => new Set(optimisticFilters.subCategory), [optimisticFilters.subCategory]);

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

  const updateUrl = (patch: {
    brand?: readonly string[];
    category?: readonly string[];
    page?: number;
    q?: string | null;
    room?: readonly string[];
    sort?: SelectedProductFilters["sort"];
    status?: SelectedProductFilters["status"];
    subCategory?: readonly string[];
  }) => {
    const nextFilters: SelectedProductFilters = {
      ...optimisticFilters,
      brand: patch.brand ?? optimisticFilters.brand,
      category: patch.category ?? optimisticFilters.category,
      room: patch.room ?? optimisticFilters.room,
      sort: patch.sort ?? optimisticFilters.sort,
      status: patch.status !== undefined ? patch.status : optimisticFilters.status,
      subCategory: patch.subCategory ?? optimisticFilters.subCategory,
      q: patch.q !== undefined ? patch.q?.trim() ?? "" : optimisticFilters.q,
      page: patch.page ?? 1,
    };

    const params = new URLSearchParams();
    setMultiParam(params, "brand", nextFilters.brand);
    setMultiParam(params, "category", nextFilters.category);
    setMultiParam(params, "subCategory", nextFilters.subCategory);
    setMultiParam(params, "room", nextFilters.room);
    if (nextFilters.status) params.set("status", nextFilters.status);
    if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
    if (nextFilters.sort !== "priority") params.set("sort", nextFilters.sort);
    if (nextFilters.page > 1) params.set("page", String(nextFilters.page));
    const qs = params.toString();
    startTransition(() => {
      setOptimisticFilters(nextFilters);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const appliedFilters = useMemo(() => {
    const filters = [
      ...optimisticFilters.brand.map((slug) => brandLabel.get(slug) ?? slug),
      ...optimisticFilters.category.map((slug) => categoryLabel.get(slug) ?? slug),
      ...optimisticFilters.subCategory.map((slug) => categoryLabel.get(slug) ?? slug),
      ...optimisticFilters.room.map((slug) => roomLabel.get(slug) ?? slug),
    ];
    if (optimisticFilters.status) filters.push(optimisticFilters.status);
    if (optimisticFilters.q.trim()) filters.push(optimisticFilters.q.trim());
    return filters;
  }, [brandLabel, categoryLabel, optimisticFilters, roomLabel]);

  const resetFilters = () => {
    startTransition(() => {
      setOptimisticFilters({
        brand: [],
        category: [],
        page: 1,
        q: "",
        room: [],
        sort: "priority",
        status: null,
        subCategory: [],
      });
      router.push(pathname, { scroll: false });
    });
    setFiltersOpen(false);
  };

  const removeFilter = (label: string) => {
    const brand = optimisticFilters.brand.find((slug) => (brandLabel.get(slug) ?? slug) === label);
    if (brand) return updateUrl({ brand: optimisticFilters.brand.filter((slug) => slug !== brand) });
    const category = optimisticFilters.category.find((slug) => (categoryLabel.get(slug) ?? slug) === label);
    if (category) return updateUrl({ category: optimisticFilters.category.filter((slug) => slug !== category) });
    const subCategory = optimisticFilters.subCategory.find((slug) => (categoryLabel.get(slug) ?? slug) === label);
    if (subCategory) return updateUrl({ subCategory: optimisticFilters.subCategory.filter((slug) => slug !== subCategory) });
    const room = optimisticFilters.room.find((slug) => (roomLabel.get(slug) ?? slug) === label);
    if (room) return updateUrl({ room: optimisticFilters.room.filter((slug) => slug !== room) });
    if (optimisticFilters.status === label) return updateUrl({ status: null });
    if (optimisticFilters.q === label) return updateUrl({ q: null });
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        sortBy={optimisticFilters.sort}
      />
      {filtersOpen ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/40 lg:hidden" role="dialog" aria-modal="true" aria-label="Bộ lọc sản phẩm">
          <div className="h-dvh w-full max-w-[420px] overflow-y-auto bg-white pb-8 shadow-[-12px_0_30px_rgba(0,0,0,0.18)]">
            <div className="sticky top-0 z-30 mb-4 flex flex-col gap-3 border-b border-nh-border bg-white px-4 pb-3 pt-4 sm:px-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-medium uppercase text-nh-ink">Bộ lọc</h2>
                <button className="flex size-11 items-center justify-center" type="button" aria-label="Đóng bộ lọc" onClick={() => setFiltersOpen(false)}>
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
                selectedStatus={optimisticFilters.status}
                selectedSubCategories={selectedSubCategories}
                toggleBrand={(brand) => updateUrl({ brand: toggleValue(optimisticFilters.brand, brand) })}
                toggleCategory={(category) => updateUrl({ category: toggleValue(optimisticFilters.category, category), subCategory: [] })}
                toggleRoom={(room) => updateUrl({ room: toggleValue(optimisticFilters.room, room) })}
                toggleStatus={(status) => updateUrl({ status: optimisticFilters.status === status ? null : status })}
                toggleSubCategory={(subCategory) => updateUrl({ subCategory: toggleValue(optimisticFilters.subCategory, subCategory) })}
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
            selectedStatus={optimisticFilters.status}
            selectedSubCategories={selectedSubCategories}
            toggleBrand={(brand) => updateUrl({ brand: toggleValue(optimisticFilters.brand, brand) })}
            toggleCategory={(category) => updateUrl({ category: toggleValue(optimisticFilters.category, category), subCategory: [] })}
            toggleRoom={(room) => updateUrl({ room: toggleValue(optimisticFilters.room, room) })}
            toggleStatus={(status) => updateUrl({ status: optimisticFilters.status === status ? null : status })}
            toggleSubCategory={(subCategory) => updateUrl({ subCategory: toggleValue(optimisticFilters.subCategory, subCategory) })}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <BrandSelector
              brandOptions={brandOptions}
              selectedBrands={selectedBrands}
              toggleBrand={(brand) => updateUrl({ brand: toggleValue(optimisticFilters.brand, brand) })}
            />
            <SearchBar
              search={optimisticFilters.q}
              setSearch={(q) => updateUrl({ q, page: 1 })}
            />
            <ProductGrid products={products} favorites={favorites} onToggleFavorite={toggleFavorite} />
            <Pagination
              currentPage={optimisticFilters.page}
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
