"use client";

import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

export function Pagination({ currentPage, setCurrentPage }: PaginationProps) {
  const pages = [1, 2, 3, 4, 5];

  return (
    <nav className="flex flex-wrap items-center gap-2 overflow-x-auto py-2 sm:gap-4">
      {pages.map((page) => {
        const active = currentPage === page;
        return (
          <button
            className={cn(
              "flex size-8 items-center justify-center border bg-white text-center text-[14px] font-normal leading-6 sm:size-9 sm:text-[16px]",
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
      <span className="text-[14px] font-normal leading-6 text-nh-muted sm:text-[16px]">...</span>
      <button
        className={cn(
          "flex size-8 items-center justify-center border bg-white text-center text-[14px] font-normal leading-6 sm:size-9 sm:text-[16px]",
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
