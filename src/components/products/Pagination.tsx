"use client";

import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  totalCount: number;
}

function visiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

export function Pagination({ currentPage, pageSize, setCurrentPage, totalCount }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const pages = visiblePages(currentPage, totalPages);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 overflow-x-auto py-2 sm:gap-3">
      {pages[0] > 1 ? (
        <>
          <PageButton active={currentPage === 1} page={1} setCurrentPage={setCurrentPage} />
          <span className="text-[12px] font-normal leading-5 text-nh-muted sm:text-[14px]">...</span>
        </>
      ) : null}
      {pages.map((page) => (
        <PageButton active={currentPage === page} key={page} page={page} setCurrentPage={setCurrentPage} />
      ))}
      {pages[pages.length - 1] < totalPages ? (
        <>
          <span className="text-[12px] font-normal leading-5 text-nh-muted sm:text-[14px]">...</span>
          <PageButton active={currentPage === totalPages} page={totalPages} setCurrentPage={setCurrentPage} />
        </>
      ) : null}
    </nav>
  );
}

function PageButton({ active, page, setCurrentPage }: { active: boolean; page: number; setCurrentPage: (page: number) => void }) {
  return (
    <button
      className={cn(
        "flex size-7 items-center justify-center border bg-white text-center text-[12px] font-normal leading-5 sm:size-8 sm:text-[14px]",
        active ? "border-nh-icon-gray text-nh-ink" : "border-nh-border text-nh-muted"
      )}
      data-page={page}
      type="button"
      onClick={() => setCurrentPage(page)}
    >
      {page}
    </button>
  );
}
