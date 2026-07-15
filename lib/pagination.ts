export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: PageSize;
  totalPages: number;
};

export function clampPage(page: number, totalPages: number) {
  if (totalPages < 1) {
    return 1;
  }
  return Math.min(Math.max(1, page), totalPages);
}

export function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function parsePaginationParams(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams
): { page: number; pageSize: PageSize } {
  const get = (key: string) => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }
    const value = searchParams[key];
    return typeof value === "string" ? value : undefined;
  };

  const rawPage = Number(get("page") ?? "1");
  const rawSize = Number(get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
  const pageSize = isPageSize(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  return { page, pageSize };
}

export function paginationSkipTake(page: number, pageSize: PageSize) {
  const safePage = Math.max(1, page);
  return {
    skip: (safePage - 1) * pageSize,
    take: pageSize
  };
}

export function toPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: PageSize
): PaginatedResult<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = clampPage(page, totalPages || 1);
  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages
  };
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

export function buildPageQueryString(
  base: Record<string, string | undefined> | URLSearchParams,
  page: number,
  pageSize: PageSize
) {
  const params =
    base instanceof URLSearchParams
      ? new URLSearchParams(base)
      : new URLSearchParams(
          Object.entries(base).filter((entry): entry is [string, string] => Boolean(entry[1]))
        );
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}
