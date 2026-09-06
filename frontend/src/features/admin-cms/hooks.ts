import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import {
  adminCreate,
  adminGet,
  adminList,
  adminRollback,
  adminTransition,
  adminUpdate,
  adminVersions,
} from "../admin-shared/crud";
import { makeCrudHooks } from "../admin-shared/hooks";
import type { PageSectionRow, PageSectionWrite, RedirectRow, SiteSettingRow, TagRow } from "./types";

const SECTIONS = "/admin/cms/sections/";

// --- CMS sections: full CRUD + workflow + versions -----------------

export function useSections(params: Record<string, string> = {}) {
  return useQuery<Paginated<PageSectionRow>>({
    queryKey: ["admin", "cms-sections", "list", params],
    queryFn: () => adminList<PageSectionRow>(SECTIONS, params),
    placeholderData: keepPreviousData,
  });
}

export function useSection(id: number | null) {
  return useQuery<PageSectionRow>({
    queryKey: ["admin", "cms-sections", "detail", id],
    queryFn: () => adminGet<PageSectionRow>(SECTIONS, id!),
    enabled: id != null,
  });
}

function useSectionInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "cms-sections"] });
}

export function useSectionCreate() {
  const invalidate = useSectionInvalidate();
  return useMutation({
    mutationFn: (body: PageSectionWrite) => adminCreate<PageSectionRow>(SECTIONS, body),
    onSuccess: invalidate,
  });
}

export function useSectionUpdate() {
  const invalidate = useSectionInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<PageSectionWrite> }) =>
      adminUpdate<PageSectionRow>(SECTIONS, id, body),
    onSuccess: invalidate,
  });
}

export function useSectionTransition() {
  const invalidate = useSectionInvalidate();
  return useMutation({
    mutationFn: ({ id, to, note }: { id: number; to: string; note: string }) =>
      adminTransition<PageSectionRow>(SECTIONS, id, to, note),
    onSuccess: invalidate,
  });
}

export function useSectionVersions(id: number | null) {
  return useQuery({
    queryKey: ["admin", "cms-sections", "versions", id],
    queryFn: () => adminVersions(SECTIONS, id!),
    enabled: id != null,
  });
}

export function useSectionRollback() {
  const invalidate = useSectionInvalidate();
  return useMutation({
    mutationFn: ({ id, versionId }: { id: number; versionId: number }) =>
      adminRollback<PageSectionRow>(SECTIONS, id, versionId),
    onSuccess: invalidate,
  });
}

// --- settings / tags / redirects: plain CRUD ---------------------

export const settings = makeCrudHooks<SiteSettingRow, Omit<SiteSettingRow, "id">>(
  "cms-settings",
  "/admin/cms/settings/",
);
export const tags = makeCrudHooks<TagRow, Omit<TagRow, "id">>("cms-tags", "/admin/cms/tags/");
export const redirects = makeCrudHooks<RedirectRow, Omit<RedirectRow, "id" | "created_at">>(
  "cms-redirects",
  "/admin/cms/redirects/",
);
