/**
 * Read-only hooks for the audit log. The API is cursor-paginated
 * (newest first, append-heavy — docs/API_DESIGN.md), so a page is
 * addressed by the opaque `cursor` taken from the previous response's
 * `next`/`previous` URL rather than a page number. There are no
 * mutations: the trail is append-only for everyone.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { CursorPage } from "../../api/envelope";
import { apiGet } from "../../api/request";
import type { AuditRow } from "./types";

const BASE = "/admin/audit/";

export function useAuditLog(params: Record<string, string>) {
  return useQuery<CursorPage<AuditRow>>({
    queryKey: ["admin", "audit", "list", params],
    queryFn: () => apiGet<CursorPage<AuditRow>>(BASE, params),
    placeholderData: keepPreviousData,
  });
}

/** The `cursor` query parameter of a `next`/`previous` link, or null. */
export function cursorFrom(link: string | null): string | null {
  if (!link) return null;
  try {
    return new URL(link, "http://x").searchParams.get("cursor");
  } catch {
    return null;
  }
}
