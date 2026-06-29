"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const selectedBrands = useMemo(() => new Set(currentFilters.brand), [currentFilters.brand]);
  const selectedCategories = useMemo(() => new Set(currentFilters.category), [currentFilters.category]);
  const selectedRooms = useMemo(() => new Set(currentFilters.room), [currentFilters.room]);
  const selectedSubCategories = useMemo(() => new Set(currentFilters.subCategory), [currentFilters.subCategory]);

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
    const params = new URLSearchParams(searchParams.toString());
    if (patch.brand !== undefined) setMultiParam(params, "brand", patch.brand);
    if (patch.category !== undefined) setMultiParam(params, "category", patch.category);
    if (patch.subCategory !== undefined) setMultiParam(params, "subCategory", patch.subCategory);
    if (patch.room !== undefined) setMultiParam(params, "room", patch.room);
    if (patch.status !== undefined) {
      if (patch.status === null) params.delete("status");
      else params.set("status", patch.status);
    }
    if (patch.q !== undefined) {
      if (patch.q === null || patch.q.trim() === "") params.delete("q");
      else params.set("q", patch.q.trim());
    }
    if (patch.sort !== undefined) params.set("sort", patch.sort);
    if (patch.page !== undefined) {
      if (patch.page <= 1) params.delete("page");
      else params.set("page", String(patch.page));
    }
    if (patch.page === undefined) params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const appliedFilters = useMemo(() => {
    const filters = [
      ...currentFilters.brand.map((slug) => brandLabel.get(slug) ?? slug),
      ...currentFilters.category.map((slug) => categoryLabel.get(slug) ?? slug),
      ...currentFilters.subCategory.map((slug) => categoryLabel.get(slug) ?? slug),
      ...currentFilters.room.map((slug) => roomLabel.get(slug) ?? slug),
    ];
    if (currentFilters.status) filters.push(currentFilters.status);
    if (currentFilters.q.trim()) filters.push(currentFilters.q.trim());
    return filters;
  }, [brandLabel, categoryLabel, currentFilters, roomLabel]);

  const resetFilters = () => {
    router.push(pathname, { scroll: false });
    setFiltersOpen(false);
  };

  const removeFilter = (label: string) => {
    const brand = currentFilters.brand.find((slug) => (brandLabel.get(slug) ?? slug) === label);
    if (brand) return updateUrl({ brand: currentFilters.brand.filter((slug) => slug !== brand) });
    const category = currentFilters.category.find((slug) => (categoryLabel.get(slug) ?? slug) === label);
    if (category) return updateUrl({ category: currentFilters.category.filter((slug) => slug !== category) });
    const subCategory = currentFilters.subCategory.find((slug) => (categoryLabel.get(slug) ?? slug) === label);
    if (subCategory) return updateUrl({ subCategory: currentFilters.subCategory.filter((slug) => slug !== subCategory) });
    const room = currentFilters.room.find((slug) => (roomLabel.get(slug) ?? slug) === label);
    if (room) return updateUrl({ room: currentFilters.room.filter((slug) => slug !== room) });
    if (currentFilters.status === label) return updateUrl({ status: null });
    if (currentFilters.q === label) return updateUrl({ q: null });
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
        sortBy={currentFilters.sort}
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
                selectedStatus={currentFilters.status}
                selectedSubCategories={selectedSubCategories}
                toggleBrand={(brand) => updateUrl({ brand: toggleValue(currentFilters.brand, brand) })}
                toggleCategory={(category) => updateUrl({ category: toggleValue(currentFilters.category, category), subCategory: [] })}
                toggleRoom={(room) => updateUrl({ room: toggleValue(currentFilters.room, room) })}
                toggleStatus={(status) => updateUrl({ status: currentFilters.status === status ? null : status })}
                toggleSubCategory={(subCategory) => updateUrl({ subCategory: toggleValue(currentFilters.subCategory, subCategory) })}
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
            selectedStatus={currentFilters.status}
            selectedSubCategories={selectedSubCategories}
            toggleBrand={(brand) => updateUrl({ brand: toggleValue(currentFilters.brand, brand) })}
            toggleCategory={(category) => updateUrl({ category: toggleValue(currentFilters.category, category), subCategory: [] })}
            toggleRoom={(room) => updateUrl({ room: toggleValue(currentFilters.room, room) })}
            toggleStatus={(status) => updateUrl({ status: currentFilters.status === status ? null : status })}
            toggleSubCategory={(subCategory) => updateUrl({ subCategory: toggleValue(currentFilters.subCategory, subCategory) })}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <BrandSelector
              brandOptions={brandOptions}
              selectedBrands={selectedBrands}
              toggleBrand={(brand) => updateUrl({ brand: toggleValue(currentFilters.brand, brand) })}
            />
            <SearchBar
              search={currentFilters.q}
              setSearch={(q) => updateUrl({ q, page: 1 })}
            />
            <ProductGrid products={products} favorites={favorites} onToggleFavorite={toggleFavorite} />
            <Pagination
              currentPage={currentFilters.page}
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
