"use client";

import { useMemo, useState } from "react";
import { CatalogHeader } from "./catalog-header";
import { SectionHeader } from "./SectionHeader";
import { FilterSidebar } from "./FilterSidebar";
import { AppliedFilters } from "./AppliedFilters";
import { BrandSelector } from "./BrandSelector";
import { SearchBar } from "./SearchBar";
import { ProductGrid } from "./ProductGrid";
import { Pagination } from "./Pagination";

export function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [selectedClassify, setSelectedClassify] = useState<Set<string>>(new Set());
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [sortBy] = useState("recommended");

  const appliedFilters = useMemo(() => {
    const filters = [
      ...(selectedCategory !== "Tất cả" ? [selectedCategory] : []),
      ...Array.from(selectedClassify),
      ...Array.from(selectedRooms),
    ];

    if (search.trim()) {
      filters.push(search.trim());
    }

    return filters;
  }, [search, selectedCategory, selectedClassify, selectedRooms]);

  const toggleClassify = (value: string) => {
    setSelectedClassify((current) => {
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

  const removeFilter = (value: string) => {
    if (value === selectedCategory) setSelectedCategory("Tất cả");
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
    if (value === search.trim()) setSearch("");
  };

  const toggleFavorite = (id: number) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-white text-nh-ink">
      <CatalogHeader />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHeader sortBy={sortBy} />
        <div className="flex flex-col gap-9 lg:flex-row lg:items-start">
          <FilterSidebar
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedClassify={selectedClassify}
            toggleClassify={toggleClassify}
            selectedRooms={selectedRooms}
            toggleRoom={toggleRoom}
          />
          <div className="flex flex-1 flex-col gap-8">
            <AppliedFilters appliedFilters={appliedFilters} onRemove={removeFilter} />
            <BrandSelector />
            <SearchBar search={search} setSearch={setSearch} />
            <ProductGrid favorites={favorites} onToggleFavorite={toggleFavorite} />
            <Pagination currentPage={currentPage} setCurrentPage={setCurrentPage} />
          </div>
        </div>
      </div>
    </main>
  );
}
