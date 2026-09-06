/**
 * Query/mutation hook factory for a plain admin CRUD resource (no
 * workflow). Sections use the fuller set in `admin-cms/hooks.ts`; every
 * other simple resource (settings, tags, redirects, …) gets these.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import {
  adminCreate,
  adminGet,
  adminList,
  adminRemove,
  adminRollback,
  adminTransition,
  adminUpdate,
  adminVersions,
} from "./crud";

export function makeCrudHooks<TRow, TWrite>(resource: string, basePath: string) {
  const listKey = (params: Record<string, string>) => ["admin", resource, "list", params] as const;

  function useList(params: Record<string, string> = {}) {
    return useQuery<Paginated<TRow>>({
      queryKey: listKey(params),
      queryFn: () => adminList<TRow>(basePath, params),
      placeholderData: keepPreviousData,
    });
  }

  function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: ["admin", resource] });
  }

  function useCreate(): UseMutationResult<TRow, unknown, TWrite> {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: (body: TWrite) => adminCreate<TRow>(basePath, body), onSuccess: invalidate });
  }

  function useUpdate(): UseMutationResult<TRow, unknown, { id: number; body: Partial<TWrite> }> {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: ({ id, body }: { id: number; body: Partial<TWrite> }) =>
        adminUpdate<TRow>(basePath, id, body),
      onSuccess: invalidate,
    });
  }

  function useRemove(): UseMutationResult<unknown, unknown, number> {
    const invalidate = useInvalidate();
    return useMutation({ mutationFn: (id: number) => adminRemove(basePath, id), onSuccess: invalidate });
  }

  return { useList, useCreate, useUpdate, useRemove };
}

/**
 * Same as `makeCrudHooks` plus the publishing-workflow calls, for
 * services / portfolio / news / cms-sections-style resources.
 */
export function makeWorkflowHooks<TRow extends { id: number }, TWrite>(
  resource: string,
  basePath: string,
) {
  const crud = makeCrudHooks<TRow, TWrite>(resource, basePath);

  function useDetail(id: number | null) {
    return useQuery<TRow>({
      queryKey: ["admin", resource, "detail", id],
      queryFn: () => adminGet<TRow>(basePath, id!),
      enabled: id != null,
    });
  }

  function useInvalidate() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: ["admin", resource] });
  }

  function useTransition() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: ({ id, to, note }: { id: number; to: string; note: string }) =>
        adminTransition<TRow>(basePath, id, to, note),
      onSuccess: invalidate,
    });
  }

  function useVersions(id: number | null) {
    return useQuery({
      queryKey: ["admin", resource, "versions", id],
      queryFn: () => adminVersions(basePath, id!),
      enabled: id != null,
    });
  }

  function useRollback() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: ({ id, versionId }: { id: number; versionId: number }) =>
        adminRollback<TRow>(basePath, id, versionId),
      onSuccess: invalidate,
    });
  }

  return { ...crud, useDetail, useTransition, useVersions, useRollback };
}
