export type SortDirection = "asc" | "desc";

export type SortValue = string | number | Date | boolean | null | undefined;

export function compareSortValues(a: SortValue, b: SortValue, direction: SortDirection): number {
  const multiplier = direction === "asc" ? 1 : -1;

  if (a == null && b == null) return 0;
  if (a == null) return 1 * multiplier;
  if (b == null) return -1 * multiplier;

  if (a instanceof Date && b instanceof Date) {
    return (a.getTime() - b.getTime()) * multiplier;
  }

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * multiplier;
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return (Number(a) - Number(b)) * multiplier;
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }) * multiplier;
}

export function sortData<T>(
  data: T[],
  sortValue: (row: T) => SortValue,
  direction: SortDirection
): T[] {
  return [...data].sort((left, right) => compareSortValues(sortValue(left), sortValue(right), direction));
}
