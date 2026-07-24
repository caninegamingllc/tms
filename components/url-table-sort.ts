"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SortDirection } from "@/lib/table-sort";

/**
 * URL-driven table sort for server-paginated lists.
 * Updates `sort`, `dir`, and resets `page` to 1.
 */
export function useUrlTableSort(defaultSort: { columnId: string; direction: SortDirection }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columnId = searchParams.get("sort") ?? defaultSort.columnId;
  const rawDir = searchParams.get("dir");
  const direction: SortDirection =
    rawDir === "asc" || rawDir === "desc"
      ? rawDir
      : searchParams.get("sort")
        ? "asc"
        : defaultSort.direction;

  const onSort = useCallback(
    (nextColumnId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", nextColumnId);
      if (columnId === nextColumnId) {
        params.set("dir", direction === "asc" ? "desc" : "asc");
      } else {
        params.set("dir", "asc");
      }
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [columnId, direction, pathname, router, searchParams]
  );

  return { columnId, direction, onSort };
}
