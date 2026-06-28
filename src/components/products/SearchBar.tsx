"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

interface SearchBarProps {
  search: string;
  setSearch: (value: string) => void;
}

export function SearchBar({ search, setSearch }: SearchBarProps) {
  const t = useTranslations("Products");

  return (
    <label className="flex w-full items-center gap-2 rounded-lg border border-nh-border px-4 py-3">
      <Search className="size-4 text-nh-ink" />
      <input
        className="w-full bg-transparent text-[12px] font-normal leading-4 text-nh-ink outline-none placeholder:text-nh-border"
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </label>
  );
}
