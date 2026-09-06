/**
 * Query/mutation hooks for the admin Inbox. Each resource is
 * list + detail + a `status`/`assigned_to` PATCH — there is no create
 * (leads and applications only ever arrive through the public API) and
 * no delete except for applications (`applications.delete_jobapplication`).
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import { apiGet, apiPost } from "../../api/request";
import { adminGet, adminList, adminRemove, adminUpdate } from "../admin-shared/crud";
import type { ApplicationRow, EnquiryNote, EnquiryRow, QuoteRequestRow } from "./types";

function makeInboxHooks<TRow extends { id: number }, TWrite>(resource: string, basePath: string) {
  const rootKey = ["admin", resource] as const;

  function useList(params: Record<string, string> = {}) {
    return useQuery<Paginated<TRow>>({
      queryKey: [...rootKey, "list", params],
      queryFn: () => adminList<TRow>(basePath, params),
      placeholderData: keepPreviousData,
    });
  }

  function useDetail(id: number | null) {
    return useQuery<TRow>({
      queryKey: [...rootKey, "detail", id],
      queryFn: () => adminGet<TRow>(basePath, id!),
      enabled: id != null,
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, body }: { id: number; body: Partial<TWrite> }) =>
        adminUpdate<TRow>(basePath, id, body),
      onSuccess: () => qc.invalidateQueries({ queryKey: rootKey }),
    });
  }

  return { rootKey, basePath, useList, useDetail, useUpdate };
}

type LeadWrite = { status: string; assigned_to: number | null };

export const quoteRequests = makeInboxHooks<QuoteRequestRow, LeadWrite>(
  "quote-requests",
  "/admin/quote-requests/",
);
export const enquiries = makeInboxHooks<EnquiryRow, LeadWrite>("enquiries", "/admin/enquiries/");
export const applications = makeInboxHooks<ApplicationRow, { status: string; assigned_to: number | null }>(
  "applications",
  "/admin/career-applications/",
);

/** Append an internal note to an enquiry (`POST …/enquiries/{id}/notes/`). */
export function useAddEnquiryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      apiPost<EnquiryNote>(`${enquiries.basePath}${id}/notes/`, { note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: enquiries.rootKey }),
  });
}

/** Delete a job application (`applications.delete_jobapplication`). */
export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminRemove(applications.basePath, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: applications.rootKey }),
  });
}

/**
 * Fetch a short-lived signed résumé URL on demand
 * (`GET …/career-applications/{id}/resume/`). The download is logged +
 * refused while the file is still being scanned (docs/FILE_STORAGE.md).
 */
export function useResumeUrl() {
  return useMutation({
    mutationFn: (id: number) =>
      apiGet<{ url: string; expires_in: number }>(`${applications.basePath}${id}/resume/`),
  });
}
