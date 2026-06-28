"use client";

import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

export function Pagination({ currentPage, setCurrentPage }: PaginationProps) {
  const pages = [1, 2, 3, 4, 5];

  return (
    <nav className="flex items-center gap-4 py-2">
      {pages.map((page) => {
        const active = currentPage === page;
        return (
          <button
            className={cn(
              "flex size-9 items-center justify-center border bg-white text-center text-[16px] font-normal leading-6",
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
      <span className="text-[16px] font-normal leading-6 text-nh-muted">...</span>
      <button
        className={cn(
          "flex size-9 items-center justify-center border bg-white text-center text-[16px] font-normal leading-6",
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
