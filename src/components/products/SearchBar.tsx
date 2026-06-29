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
    <label className="flex w-full items-center gap-2 border-b border-nh-border px-0 py-3">
      <Search className="size-3.5 text-nh-muted" strokeWidth={1.5} />
      <input
        className="w-full bg-transparent text-[12px] font-normal leading-4 text-nh-ink outline-none placeholder:text-nh-border"
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </label>
  );
}
