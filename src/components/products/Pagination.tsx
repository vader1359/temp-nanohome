"use client";

import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

export function Pagination({ currentPage, setCurrentPage }: PaginationProps) {
  const pages = [1, 2, 3, 4, 5];

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 overflow-x-auto py-2 sm:gap-3">
      {pages.map((page) => {
        const active = currentPage === page;
        return (
          <button
            className={cn(
              "flex size-7 items-center justify-center border bg-white text-center text-[12px] font-normal leading-5 sm:size-8 sm:text-[14px]",
              active ? "border-nh-icon-gray text-nh-ink" : "border-nh-border text-nh-muted"
            )}
            key={page}
            type="button"
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        );
      })}
      <span className="text-[12px] font-normal leading-5 text-nh-muted sm:text-[14px]">...</span>
      <button
        className={cn(
          "flex size-7 items-center justify-center border bg-white text-center text-[12px] font-normal leading-5 sm:size-8 sm:text-[14px]",
          currentPage === 99 ? "border-nh-icon-gray text-nh-ink" : "border-nh-border text-nh-muted"
        )}
        type="button"
        onClick={() => setCurrentPage(99)}
      >
        99
      </button>
    </nav>
  );
}
