export const SEARCH_SUBMITTED_PARAM = "search";

export function isSearchSubmitted(searchParams: Record<string, string | string[] | undefined>) {
  const value = searchParams[SEARCH_SUBMITTED_PARAM];
  return value === "1" || value === "true";
}

export function appendSearchSubmitted(queryString: string) {
  const params = new URLSearchParams(queryString);
  params.set(SEARCH_SUBMITTED_PARAM, "1");
  return params.toString();
}
