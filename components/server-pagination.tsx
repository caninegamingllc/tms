"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TablePagination } from "@/components/table-pagination";
import { isPageSize, type PageSize } from "@/lib/pagination";

type ServerPaginationProps = {
  page: number;
  pageSize: PageSize;
  total: number;
  totalPages: number;
  /** Preserve these query keys when changing page (defaults to all current params). */
  preserveKeys?: string[];
};

export function ServerPagination({
  page,
  pageSize,
  total,
  totalPages
}: ServerPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (total === 0) {
    return null;
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function push(nextPage: number, nextSize: PageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextSize));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <TablePagination
      page={page}
      pageSize={pageSize}
      total={total}
      totalPages={totalPages}
      start={start}
      end={end}
      onPageChange={(next) => push(next, pageSize)}
      onPageSizeChange={(size) => {
        if (!isPageSize(size)) return;
        push(1, size);
      }}
    />
  );
}
