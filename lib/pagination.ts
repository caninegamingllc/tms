export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export function clampPage(page: number, totalPages: number) {
  if (totalPages < 1) {
    return 1;
  }
  return Math.min(Math.max(1, page), totalPages);
}

export function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function paginateRows<T>(rows: T[], page: number, pageSize: PageSize) {
  const total = rows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = clampPage(page, totalPages || 1);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize;
  const end = total === 0 ? 0 : Math.min(start + pageSize, total);
  const pageRows = rows.slice(start, end);

  return {
    pageRows,
    page: safePage,
    pageSize,
    total,
    totalPages,
    start: total === 0 ? 0 : start + 1,
    end
  };
}
