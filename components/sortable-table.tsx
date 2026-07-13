"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { clsx } from "clsx";
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
};

export function SortableTable<T>({
  columns,
  data,
  defaultSort,
  keyExtractor,
  emptyMessage = "No records found.",
  className
}: SortableTableProps<T>) {
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

  const sortableColumnCount = columns.filter((column) => column.sortable !== false && column.sortValue).length;

  return (
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
        {sortedData.length ? (
          sortedData.map((row) => (
            <tr key={keyExtractor(row)}>
              {columns.map((column) => (
                <td key={column.id} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
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
