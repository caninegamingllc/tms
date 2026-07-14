"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { clsx } from "clsx";
import { TablePagination } from "@/components/table-pagination";
import {
  DEFAULT_PAGE_SIZE,
  isPageSize,
  paginateRows,
  type PageSize
} from "@/lib/pagination";
import { sortData, type SortDirection } from "@/lib/table-sort";

export type SortableColumn<T> = {
  id: string;
  label: React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | Date | boolean | null | undefined;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
};

type SortableTableProps<T> = {
  columns: SortableColumn<T>[];
  data: T[];
  defaultSort?: { columnId: string; direction: SortDirection };
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  className?: string;
  /** When false, render all rows without pagination controls. Default true. */
  paginated?: boolean;
  /** When set, clicking anywhere on the row navigates to this href (except interactive controls). */
  getRowHref?: (row: T) => string | undefined;
};

const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, [role='button']";

export function navigateFromRowClick(
  event: MouseEvent<HTMLElement>,
  href: string,
  push: (href: string) => void
) {
  const target = event.target as HTMLElement | null;
  if (target?.closest(INTERACTIVE_SELECTOR)) {
    return;
  }

  if (event.metaKey || event.ctrlKey || event.button === 1) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }

  push(href);
}

export function navigateFromRowKeyDown(
  event: KeyboardEvent<HTMLElement>,
  href: string,
  push: (href: string) => void
) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const target = event.target as HTMLElement | null;
  if (target?.closest(INTERACTIVE_SELECTOR) && target !== event.currentTarget) {
    return;
  }

  event.preventDefault();
  push(href);
}

export function useClientPagination<T>(rows: T[], resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);

  const pagination = useMemo(() => paginateRows(rows, page, pageSize), [rows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (pagination.page !== page) {
      setPage(pagination.page);
    }
  }, [pagination.page, page]);

  function handlePageSizeChange(next: number) {
    if (!isPageSize(next)) {
      return;
    }
    setPageSize(next);
    setPage(1);
  }

  return {
    pageRows: pagination.pageRows,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: pagination.totalPages,
    start: pagination.start,
    end: pagination.end,
    setPage,
    setPageSize: handlePageSizeChange
  };
}

export function SortableTable<T>({
  columns,
  data,
  defaultSort,
  keyExtractor,
  emptyMessage = "No records found.",
  className,
  paginated = true,
  getRowHref
}: SortableTableProps<T>) {
  const router = useRouter();
  const firstSortableColumn = columns.find((column) => column.sortable !== false && column.sortValue);
  const [sortState, setSortState] = useState<{ columnId: string; direction: SortDirection }>(() => {
    if (defaultSort) {
      return defaultSort;
    }

    if (firstSortableColumn) {
      return { columnId: firstSortableColumn.id, direction: "asc" };
    }

    return { columnId: "", direction: "asc" };
  });

  const sortedData = useMemo(() => {
    const column = columns.find((entry) => entry.id === sortState.columnId);
    if (!column?.sortValue) {
      return data;
    }

    return sortData(data, column.sortValue, sortState.direction);
  }, [columns, data, sortState]);

  const pagination = useClientPagination(paginated ? sortedData : [], paginated ? data.length : undefined);
  const displayRows = paginated ? pagination.pageRows : sortedData;

  function handleSort(columnId: string) {
    const column = columns.find((entry) => entry.id === columnId);
    if (!column || column.sortable === false || !column.sortValue) {
      return;
    }

    setSortState((current) => {
      if (current.columnId === columnId) {
        return { columnId, direction: current.direction === "asc" ? "desc" : "asc" };
      }

      return { columnId, direction: "asc" };
    });
  }

  const sortableColumnCount = columns.filter((column) => column.sortable !== false && column.sortValue).length;

  return (
    <div>
      <table className={clsx("table", className)}>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSortable = column.sortable !== false && column.sortValue != null && sortableColumnCount > 0;
              const isActive = sortState.columnId === column.id;

              return (
                <th
                  key={column.id}
                  className={clsx(isSortable && "sortable", column.headerClassName)}
                  data-active={isActive || undefined}
                  aria-sort={
                    isSortable
                      ? isActive
                        ? sortState.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  {isSortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={() => handleSort(column.id)}
                    >
                      <span>{column.label}</span>
                      {isActive ? (
                        sortState.direction === "asc" ? (
                          <ArrowUp className="sort-icon" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="sort-icon" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown className="sort-icon" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayRows.length ? (
            displayRows.map((row) => {
              const href = getRowHref?.(row);

              return (
                <tr
                  key={keyExtractor(row)}
                  className={clsx(href && "table-row-link")}
                  tabIndex={href ? 0 : undefined}
                  onClick={href ? (event) => navigateFromRowClick(event, href, router.push) : undefined}
                  onKeyDown={href ? (event) => navigateFromRowKeyDown(event, href, router.push) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.id} className={column.className}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {paginated ? (
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          start={pagination.start}
          end={pagination.end}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      ) : null}
    </div>
  );
}

export function useSortedRows<T>(
  data: T[],
  columns: SortableColumn<T>[],
  defaultSort?: { columnId: string; direction: SortDirection }
) {
  const firstSortableColumn = columns.find((column) => column.sortable !== false && column.sortValue);
  const [sortState, setSortState] = useState<{ columnId: string; direction: SortDirection }>(() => {
    if (defaultSort) {
      return defaultSort;
    }

    if (firstSortableColumn) {
      return { columnId: firstSortableColumn.id, direction: "asc" };
    }

    return { columnId: "", direction: "asc" };
  });

  const sortedData = useMemo(() => {
    const column = columns.find((entry) => entry.id === sortState.columnId);
    if (!column?.sortValue) {
      return data;
    }

    return sortData(data, column.sortValue, sortState.direction);
  }, [columns, data, sortState]);

  function handleSort(columnId: string) {
    const column = columns.find((entry) => entry.id === columnId);
    if (!column || column.sortable === false || !column.sortValue) {
      return;
    }

    setSortState((current) => {
      if (current.columnId === columnId) {
        return { columnId, direction: current.direction === "asc" ? "desc" : "asc" };
      }

      return { columnId, direction: "asc" };
    });
  }

  return { sortedData, sortState, handleSort };
}

export function SortableTableHeader<T>({
  columns,
  sortState,
  onSort
}: {
  columns: SortableColumn<T>[];
  sortState: { columnId: string; direction: SortDirection };
  onSort: (columnId: string) => void;
}) {
  const sortableColumnCount = columns.filter((column) => column.sortable !== false && column.sortValue).length;

  return (
    <thead>
      <tr>
        {columns.map((column) => {
          const isSortable = column.sortable !== false && column.sortValue != null && sortableColumnCount > 0;
          const isActive = sortState.columnId === column.id;

          return (
            <th
              key={column.id}
              className={clsx(isSortable && "sortable", column.headerClassName)}
              data-active={isActive || undefined}
              aria-sort={
                isSortable
                  ? isActive
                    ? sortState.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                  : undefined
              }
            >
              {isSortable ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-left"
                  onClick={() => onSort(column.id)}
                >
                  <span>{column.label}</span>
                  {isActive ? (
                    sortState.direction === "asc" ? (
                      <ArrowUp className="sort-icon" aria-hidden="true" />
                    ) : (
                      <ArrowDown className="sort-icon" aria-hidden="true" />
                    )
                  ) : (
                    <ChevronsUpDown className="sort-icon" aria-hidden="true" />
                  )}
                </button>
              ) : (
                column.label
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
