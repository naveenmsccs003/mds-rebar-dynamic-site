/**
 * Keeps list filters + the current page in the URL query string so a
 * filtered list is shareable / bookmarkable / survives a refresh
 * (docs/UI_DESIGN_SYSTEM.md — server-filtered lists). Used by every
 * public list template (portfolio, resources, news, …).
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const get = useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          if (key !== "page") next.delete("page"); // any filter change resets to page 1
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback((p: number) => setParam("page", p > 1 ? String(p) : ""), [setParam]);

  /** All non-empty params except `page`, for the API call. */
  const filterParams = useMemo(() => {
    const out: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== "page" && value) out[key] = value;
    });
    return out;
  }, [searchParams]);

  return { get, page, setParam, setPage, filterParams };
}
