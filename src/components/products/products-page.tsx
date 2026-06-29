"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { FilterSidebar } from "./FilterSidebar";
import { BrandSelector } from "./BrandSelector";
import { SearchBar } from "./SearchBar";
import { ProductGrid, type ProductGridItem } from "./ProductGrid";
import { Pagination } from "./Pagination";

interface ProductsPageProps {
  brands: readonly { id: string; logoUrl: string | null; name: string }[];
  products: readonly ProductGridItem[];
}

export function ProductsPage({ brands, products }: ProductsPageProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedClassify, setSelectedClassify] = useState<Set<string>>(new Set());
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const appliedFilters = useMemo(() => {
    const filters = [
      ...Array.from(selectedCategories),
      ...Array.from(selectedClassify),
      ...Array.from(selectedRooms),
      ...Array.from(selectedBrands),
    ];

    if (search.trim()) {
      filters.push(search.trim());
    }

    return filters;
  }, [search, selectedBrands, selectedCategories, selectedClassify, selectedRooms]);

  const toggleClassify = (value: string) => {
    setSelectedClassify((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleCategory = (value: string) => {
    setSelectedCategories((current) => {
      if (value === "Tất cả") return new Set();

      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleRoom = (value: string) => {
    setSelectedRooms((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleBrand = (value: string) => {
    setSelectedBrands((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const removeFilter = (value: string) => {
    setSelectedCategories((current) => {
      const next = new Set(current);
      next.delete(value);
      return next;
    });
    setSelectedClassify((current) => {
      const next = new Set(current);
      next.delete(value);
      return next;
    });
    setSelectedRooms((current) => {
      const next = new Set(current);
      next.delete(value);
      return next;
    });
    setSelectedBrands((current) => {
      const next = new Set(current);
      next.delete(value);
      return next;
    });
    if (value === search.trim()) setSearch("");
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
        sortBy={sortBy}
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
              {appliedFilters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <span className="w-full text-[12px] font-normal leading-4 text-nh-muted">Đang áp dụng :</span>
                  {appliedFilters.map((filter) => (
                    <button
                      className="flex items-center gap-1 border border-nh-border px-1.5 py-1 text-[12px] font-normal leading-4 text-nh-ink"
                      key={filter}
                      type="button"
                      onClick={() => removeFilter(filter)}
                    >
                      {filter}
                      <X className="size-3 text-nh-ink" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="px-4 sm:px-6">
            <FilterSidebar
              brands={brands}
              variant="modal"
              selectedBrands={selectedBrands}
              selectedCategories={selectedCategories}
              toggleBrand={toggleBrand}
              toggleCategory={toggleCategory}
              selectedClassify={selectedClassify}
              toggleClassify={toggleClassify}
              selectedRooms={selectedRooms}
              toggleRoom={toggleRoom}
            />
            </div>
          </div>
        </div>
      ) : null}
      <div className="site-shell flex flex-col gap-8 pb-8 pt-0">
        <div className="flex flex-col gap-6 pt-3 sm:pt-5 lg:flex-row lg:items-start">
          <FilterSidebar
            brands={brands}
            selectedBrands={selectedBrands}
            selectedCategories={selectedCategories}
            toggleBrand={toggleBrand}
            toggleCategory={toggleCategory}
            selectedClassify={selectedClassify}
            toggleClassify={toggleClassify}
            selectedRooms={selectedRooms}
            toggleRoom={toggleRoom}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <BrandSelector brands={brands} selectedBrands={selectedBrands} toggleBrand={toggleBrand} />
            <SearchBar search={search} setSearch={setSearch} />
            <ProductGrid products={products} favorites={favorites} onToggleFavorite={toggleFavorite} />
            <Pagination currentPage={currentPage} setCurrentPage={setCurrentPage} />
          </div>
        </div>
      </div>
    </main>
  );
}
