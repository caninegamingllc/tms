"use client";

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  type PageSize
} from "@/lib/pagination";

export type TablePaginationProps = {
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
};

export function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
  start,
  end,
  onPageChange,
  onPageSizeChange
}: TablePaginationProps) {
  if (total === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-muted-foreground">
          <span>Per page</span>
          <select
            className="input w-auto py-1"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <span className="tabular-nums text-muted-foreground">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS };
