"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent
} from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical } from "lucide-react";
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
  /** When false, the column cannot be dragged to a new position. Default true. */
  reorderable?: boolean;
  /** Initial and allowed widths for user-resizable columns, in pixels. */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /** When false, the column width cannot be adjusted. Default true when tableId is set. */
  resizable?: boolean;
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
  /**
   * Stable id for persisting column order (localStorage).
   * When provided, column headers can be dragged to rearrange.
   */
  tableId?: string;
  /** Override column reorder; defaults to true when tableId is set. */
  columnReorder?: boolean;
};

const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, [role='button']";
/** Used when summing table min-width for columns without an explicit saved/default width. */
const FALLBACK_COLUMN_WIDTH = 120;

function columnOrderStorageKey(tableId: string) {
  return `tms.table.columnOrder.${tableId}`;
}

function columnWidthsStorageKey(tableId: string) {
  return `tms.table.columnWidths.${tableId}`;
}

function resolveColumnWidthPx(
  column: { id: string; width?: number; minWidth?: number },
  widths: Record<string, number>
): number {
  return widths[column.id] ?? column.width ?? column.minWidth ?? FALLBACK_COLUMN_WIDTH;
}

/**
 * When any column has an explicit width, lock the table layout and set min-width to the
 * sum of column widths so widening columns can overflow and scroll horizontally instead
 * of compressing siblings to fit the viewport.
 */
export function getResizableTableStyle(
  columns: Array<{ id: string; width?: number; minWidth?: number }>,
  widths: Record<string, number> = {}
): { tableLayout: "fixed"; width: "100%"; minWidth: number } | undefined {
  const hasExplicitWidths = columns.some(
    (column) => widths[column.id] != null || column.width != null
  );
  if (!hasExplicitWidths) {
    return undefined;
  }

  return {
    tableLayout: "fixed",
    width: "100%",
    minWidth: columns.reduce((sum, column) => sum + resolveColumnWidthPx(column, widths), 0)
  };
}

export function mergeColumnOrder(defaultIds: string[], saved: string[] | null | undefined): string[] {
  const known = new Set(defaultIds);
  const ordered = (saved ?? []).filter((id) => known.has(id));
  const seen = new Set(ordered);

  for (const id of defaultIds) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }

  return ordered;
}

export function applyColumnOrder<T extends { id: string }>(
  columns: T[],
  order: string[]
): T[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const result: T[] = [];

  for (const id of order) {
    const column = byId.get(id);
    if (column) {
      result.push(column);
      byId.delete(id);
    }
  }

  for (const column of columns) {
    if (byId.has(column.id)) {
      result.push(column);
    }
  }

  return result;
}

export function useColumnOrder(tableId: string | undefined, columnIds: string[]) {
  const defaultsKey = columnIds.join("|");
  const [order, setOrderState] = useState<string[]>(columnIds);
  const [hydrated, setHydrated] = useState(!tableId);

  useEffect(() => {
    if (!tableId) {
      setOrderState(columnIds);
      setHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(columnOrderStorageKey(tableId));
      const saved = raw ? (JSON.parse(raw) as unknown) : null;
      setOrderState(
        mergeColumnOrder(columnIds, Array.isArray(saved) ? (saved as string[]) : null)
      );
    } catch {
      setOrderState(columnIds);
    }
    setHydrated(true);
  }, [tableId, defaultsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- columnIds via defaultsKey

  const setOrder = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setOrderState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        const merged = mergeColumnOrder(columnIds, resolved);
        if (tableId) {
          try {
            window.localStorage.setItem(columnOrderStorageKey(tableId), JSON.stringify(merged));
          } catch {
            // ignore quota / private mode
          }
        }
        return merged;
      });
    },
    [columnIds, tableId]
  );

  const moveColumn = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) {
        return;
      }

      setOrder((prev) => {
        const next = [...prev];
        const fromIndex = next.indexOf(fromId);
        const toIndex = next.indexOf(toId);
        if (fromIndex < 0 || toIndex < 0) {
          return prev;
        }
        next.splice(fromIndex, 1);
        next.splice(toIndex, 0, fromId);
        return next;
      });
    },
    [setOrder]
  );

  const resetOrder = useCallback(() => {
    setOrderState(columnIds);
    if (tableId) {
      try {
        window.localStorage.removeItem(columnOrderStorageKey(tableId));
      } catch {
        // ignore
      }
    }
  }, [columnIds, tableId]);

  const isCustomized = hydrated && order.join("|") !== defaultsKey;

  return { order, setOrder, moveColumn, resetOrder, isCustomized, hydrated };
}

export function useColumnWidths(tableId: string | undefined, columnIds: string[]) {
  const defaultsKey = columnIds.join("|");
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(!tableId);

  useEffect(() => {
    if (!tableId) {
      setWidths({});
      setHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(columnWidthsStorageKey(tableId));
      const saved = raw ? (JSON.parse(raw) as unknown) : null;
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        const known = new Set(columnIds);
        const valid = Object.fromEntries(
          Object.entries(saved).filter(
            ([id, width]) => known.has(id) && typeof width === "number" && Number.isFinite(width)
          )
        ) as Record<string, number>;
        setWidths(valid);
      } else {
        setWidths({});
      }
    } catch {
      setWidths({});
    }
    setHydrated(true);
  }, [tableId, defaultsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- columnIds via defaultsKey

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      setWidths((current) => {
        const next = { ...current, [columnId]: Math.round(width) };
        if (tableId) {
          try {
            window.localStorage.setItem(columnWidthsStorageKey(tableId), JSON.stringify(next));
          } catch {
            // ignore quota / private mode
          }
        }
        return next;
      });
    },
    [tableId]
  );

  const resetWidths = useCallback(() => {
    setWidths({});
    if (tableId) {
      try {
        window.localStorage.removeItem(columnWidthsStorageKey(tableId));
      } catch {
        // ignore
      }
    }
  }, [tableId]);

  return {
    widths,
    setColumnWidth,
    resetWidths,
    isCustomized: hydrated && Object.keys(widths).length > 0,
    hydrated
  };
}

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

function ColumnHeaderCell<T>({
  column,
  isSortable,
  isActive,
  direction,
  onSort,
  reorderEnabled,
  dragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  width,
  resizeEnabled,
  onResize
}: {
  column: SortableColumn<T>;
  isSortable: boolean;
  isActive: boolean;
  direction: SortDirection;
  onSort: (columnId: string) => void;
  reorderEnabled: boolean;
  dragOver: boolean;
  onDragStart: (columnId: string, event: DragEvent<HTMLElement>) => void;
  onDragOver: (columnId: string, event: DragEvent<HTMLElement>) => void;
  onDragLeave: (columnId: string) => void;
  onDrop: (columnId: string, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  width?: number;
  resizeEnabled: boolean;
  onResize?: (columnId: string, width: number) => void;
}) {
  const canReorder = reorderEnabled && column.reorderable !== false;
  const canResize = resizeEnabled && column.resizable !== false && Boolean(onResize);

  function startResize(event: MouseEvent<HTMLSpanElement>) {
    if (!canResize || !onResize) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const header = event.currentTarget.closest("th");
    const startWidth = header?.getBoundingClientRect().width ?? width ?? column.width ?? 120;
    const startX = event.clientX;
    const minWidth = column.minWidth ?? 72;
    const maxWidth = column.maxWidth ?? 640;

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + moveEvent.clientX - startX));
      onResize?.(column.id, nextWidth);
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("table-column-resizing");
    }

    document.body.classList.add("table-column-resizing");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <th
      className={clsx(
        isSortable && "sortable",
        canReorder && "table-col-reorderable",
        dragOver && "table-col-drag-over",
        column.headerClassName
      )}
      data-active={isActive || undefined}
      data-column-id={column.id}
      style={
        width
          ? { width, minWidth: width }
          : column.width
            ? { width: column.width, minWidth: column.width }
            : undefined
      }
      aria-sort={
        isSortable
          ? isActive
            ? direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
          : undefined
      }
      onDragOver={canReorder ? (event) => onDragOver(column.id, event) : undefined}
      onDragLeave={canReorder ? () => onDragLeave(column.id) : undefined}
      onDrop={canReorder ? (event) => onDrop(column.id, event) : undefined}
    >
      <div className="inline-flex min-w-0 items-center gap-1">
        {canReorder ? (
          <span
            className="table-col-handle inline-flex shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            draggable
            title="Drag to reorder column"
            aria-label={`Reorder ${typeof column.label === "string" ? column.label : "column"}`}
            onDragStart={(event) => onDragStart(column.id, event)}
            onDragEnd={onDragEnd}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}

        {isSortable ? (
          <button
            type="button"
            className="inline-flex min-w-0 items-center gap-1 text-left"
            onClick={() => onSort(column.id)}
          >
            <span className="truncate">{column.label}</span>
            {isActive ? (
              direction === "asc" ? (
                <ArrowUp className="sort-icon" aria-hidden="true" />
              ) : (
                <ArrowDown className="sort-icon" aria-hidden="true" />
              )
            ) : (
              <ChevronsUpDown className="sort-icon" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="truncate">{column.label}</span>
        )}
      </div>
      {canResize ? (
        <span
          className="table-col-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${typeof column.label === "string" ? column.label : "column"}`}
          title="Drag to resize column"
          onMouseDown={startResize}
          onClick={(event) => event.stopPropagation()}
        />
      ) : null}
    </th>
  );
}

function useColumnDragReorder(
  enabled: boolean,
  moveColumn: (fromId: string, toId: string) => void,
  columnsById: Map<string, { reorderable?: boolean }>
) {
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const onDragStart = useCallback(
    (columnId: string, event: DragEvent<HTMLElement>) => {
      if (!enabled || columnsById.get(columnId)?.reorderable === false) {
        event.preventDefault();
        return;
      }
      dragIdRef.current = columnId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", columnId);
      // Soften ghost: browsers need some data set for DnD to work.
      if (event.currentTarget.parentElement) {
        event.dataTransfer.setDragImage(event.currentTarget.parentElement, 12, 12);
      }
    },
    [columnsById, enabled]
  );

  const onDragOver = useCallback(
    (columnId: string, event: DragEvent<HTMLElement>) => {
      if (!enabled || !dragIdRef.current) {
        return;
      }
      if (columnsById.get(columnId)?.reorderable === false) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOverId(columnId);
    },
    [columnsById, enabled]
  );

  const onDragLeave = useCallback((columnId: string) => {
    setDragOverId((current) => (current === columnId ? null : current));
  }, []);

  const onDrop = useCallback(
    (columnId: string, event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const fromId = dragIdRef.current ?? event.dataTransfer.getData("text/plain");
      dragIdRef.current = null;
      setDragOverId(null);
      if (!fromId || columnsById.get(columnId)?.reorderable === false) {
        return;
      }
      moveColumn(fromId, columnId);
    },
    [columnsById, moveColumn]
  );

  const onDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDragOverId(null);
  }, []);

  return { dragOverId, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd };
}

export function SortableTable<T>({
  columns,
  data,
  defaultSort,
  keyExtractor,
  emptyMessage = "No records found.",
  className,
  paginated = true,
  getRowHref,
  tableId,
  columnReorder
}: SortableTableProps<T>) {
  const router = useRouter();
  const reorderEnabled = columnReorder ?? Boolean(tableId);
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);
  const { order, moveColumn, resetOrder, isCustomized } = useColumnOrder(
    reorderEnabled ? tableId : undefined,
    columnIds
  );
  const {
    widths: columnWidths,
    setColumnWidth,
    resetWidths,
    isCustomized: widthsCustomized
  } = useColumnWidths(tableId, columnIds);
  const orderedColumns = useMemo(() => applyColumnOrder(columns, order), [columns, order]);
  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns]
  );
  const drag = useColumnDragReorder(reorderEnabled, moveColumn, columnsById);

  const firstSortableColumn = orderedColumns.find(
    (column) => column.sortable !== false && column.sortValue
  );
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
    const column = orderedColumns.find((entry) => entry.id === sortState.columnId);
    if (!column?.sortValue) {
      return data;
    }

    return sortData(data, column.sortValue, sortState.direction);
  }, [orderedColumns, data, sortState]);

  const pagination = useClientPagination(paginated ? sortedData : [], paginated ? data.length : undefined);
  const displayRows = paginated ? pagination.pageRows : sortedData;

  function handleSort(columnId: string) {
    const column = orderedColumns.find((entry) => entry.id === columnId);
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

  const sortableColumnCount = orderedColumns.filter(
    (column) => column.sortable !== false && column.sortValue
  ).length;

  const resetLayout = useCallback(() => {
    resetOrder();
    resetWidths();
  }, [resetOrder, resetWidths]);

  const tableSizeStyle = useMemo(
    () => getResizableTableStyle(orderedColumns, columnWidths),
    [orderedColumns, columnWidths]
  );

  return (
    <div>
      {tableId ? (
        <ColumnLayoutControls
          onReset={resetLayout}
          isCustomized={isCustomized || widthsCustomized}
        />
      ) : null}
      <div className="overflow-x-auto">
        <table className={clsx("table", className)} style={tableSizeStyle}>
          <colgroup>
            {orderedColumns.map((column) => {
              const width = columnWidths[column.id] ?? column.width;
              return (
                <col
                  key={column.id}
                  style={width != null ? { width, minWidth: width } : undefined}
                />
              );
            })}
          </colgroup>
          <thead>
            <tr>
              {orderedColumns.map((column) => {
                const isSortable =
                  column.sortable !== false && column.sortValue != null && sortableColumnCount > 0;
                const isActive = sortState.columnId === column.id;

                return (
                  <ColumnHeaderCell
                    key={column.id}
                    column={column}
                    isSortable={isSortable}
                    isActive={isActive}
                    direction={sortState.direction}
                    onSort={handleSort}
                    reorderEnabled={reorderEnabled}
                    dragOver={drag.dragOverId === column.id}
                    onDragStart={drag.onDragStart}
                    onDragOver={drag.onDragOver}
                    onDragLeave={drag.onDragLeave}
                    onDrop={drag.onDrop}
                    onDragEnd={drag.onDragEnd}
                    width={columnWidths[column.id]}
                    resizeEnabled={Boolean(tableId)}
                    onResize={setColumnWidth}
                  />
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
                    onKeyDown={
                      href ? (event) => navigateFromRowKeyDown(event, href, router.push) : undefined
                    }
                  >
                    {orderedColumns.map((column) => (
                      <td key={column.id} className={column.className}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={orderedColumns.length} className="p-8 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

export function useOrderedColumns<T extends { id: string }>(
  tableId: string | undefined,
  columns: T[]
) {
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);
  const { order, moveColumn, setOrder, resetOrder, isCustomized, hydrated } = useColumnOrder(
    tableId,
    columnIds
  );
  const {
    widths: columnWidths,
    setColumnWidth,
    resetWidths,
    isCustomized: widthsCustomized
  } = useColumnWidths(tableId, columnIds);
  const orderedColumns = useMemo(() => applyColumnOrder(columns, order), [columns, order]);
  const resetLayout = useCallback(() => {
    resetOrder();
    resetWidths();
  }, [resetOrder, resetWidths]);
  return {
    orderedColumns,
    order,
    moveColumn,
    setOrder,
    resetOrder,
    isCustomized,
    hydrated,
    columnWidths,
    setColumnWidth,
    resetWidths,
    resetLayout,
    isLayoutCustomized: isCustomized || widthsCustomized
  };
}

export function ColumnLayoutControls({
  onReset,
  isCustomized = true,
  className
}: {
  onReset: () => void;
  isCustomized?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("mb-2 flex justify-end", className)}>
      <button
        type="button"
        className="btn-secondary !px-2.5 !py-1 !text-[12px]"
        onClick={onReset}
        title={
          isCustomized
            ? "Restore the original column order and widths"
            : "Column layout is already the default"
        }
      >
        Reset to default
      </button>
    </div>
  );
}

export function SortableTableHeader<T>({
  columns,
  sortState,
  onSort,
  columnReorder = false,
  onMoveColumn,
  columnWidths,
  onColumnResize
}: {
  columns: SortableColumn<T>[];
  sortState: { columnId: string; direction: SortDirection };
  onSort: (columnId: string) => void;
  columnReorder?: boolean;
  onMoveColumn?: (fromId: string, toId: string) => void;
  columnWidths?: Record<string, number>;
  onColumnResize?: (columnId: string, width: number) => void;
}) {
  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns]
  );
  const drag = useColumnDragReorder(
    columnReorder && Boolean(onMoveColumn),
    onMoveColumn ?? (() => undefined),
    columnsById
  );

  const sortableColumnCount = columns.filter(
    (column) => column.sortable !== false && column.sortValue
  ).length;

  const widths = columnWidths ?? {};

  return (
    <>
      <colgroup>
        {columns.map((column) => {
          const width = widths[column.id] ?? column.width;
          return (
            <col
              key={column.id}
              style={width != null ? { width, minWidth: width } : undefined}
            />
          );
        })}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => {
          const isSortable =
            column.sortable !== false && column.sortValue != null && sortableColumnCount > 0;
          const isActive = sortState.columnId === column.id;

          return (
            <ColumnHeaderCell
              key={column.id}
              column={column}
              isSortable={isSortable}
              isActive={isActive}
              direction={sortState.direction}
              onSort={onSort}
              reorderEnabled={columnReorder && Boolean(onMoveColumn)}
              dragOver={drag.dragOverId === column.id}
              onDragStart={drag.onDragStart}
              onDragOver={drag.onDragOver}
              onDragLeave={drag.onDragLeave}
              onDrop={drag.onDrop}
              onDragEnd={drag.onDragEnd}
              width={widths[column.id]}
              resizeEnabled={Boolean(onColumnResize)}
              onResize={onColumnResize}
            />
          );
          })}
        </tr>
      </thead>
    </>
  );
}
