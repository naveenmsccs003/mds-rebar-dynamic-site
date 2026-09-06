/**
 * Thin CRUD + workflow helpers over `api/request.ts` for the admin
 * resources. Each admin feature composes these instead of re-writing the
 * URL building and the list/get/create/update/delete/transition/versions
 * calls (docs/API_DESIGN.md — every admin viewset has the same shape).
 */
import type { Paginated } from "../../api/envelope";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../api/request";

const joinId = (base: string, id: number | string) => `${base}${base.endsWith("/") ? "" : "/"}${id}/`;

export function adminList<T>(base: string, params: Record<string, string> = {}): Promise<Paginated<T>> {
  return apiGet<Paginated<T>>(base, params);
}

export function adminGet<T>(base: string, id: number | string): Promise<T> {
  return apiGet<T>(joinId(base, id));
}

export function adminCreate<T>(base: string, body: unknown): Promise<T> {
  return apiPost<T>(base, body);
}

export function adminUpdate<T>(base: string, id: number | string, body: unknown): Promise<T> {
  return apiPatch<T>(joinId(base, id), body);
}

export function adminRemove(base: string, id: number | string): Promise<unknown> {
  return apiDelete(joinId(base, id));
}

// --- publishing workflow (services / portfolio / news / cms sections) ---

export interface ContentVersion {
  id: number;
  snapshot: Record<string, unknown>;
  note: string;
  edited_by_email: string;
  edited_at: string;
}

export function adminTransition<T>(
  base: string,
  id: number | string,
  to: string,
  note = "",
): Promise<T> {
  return apiPost<T>(`${joinId(base, id)}transition/`, { to, note });
}

export function adminVersions(
  base: string,
  id: number | string,
): Promise<Paginated<ContentVersion>> {
  return apiGet<Paginated<ContentVersion>>(`${joinId(base, id)}versions/`);
}

export function adminRollback<T>(base: string, id: number | string, versionId: number): Promise<T> {
  return apiPost<T>(`${joinId(base, id)}versions/${versionId}/rollback/`);
}
