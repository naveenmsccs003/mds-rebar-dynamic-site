/**
 * The declared-upload flow for an image (docs/FILE_STORAGE.md):
 *
 *   1. POST /api/v1/admin/documents/upload/   -> a Document (pending) + a ticket
 *   2. PUT the bytes to the ticket URL         (local backend or S3)
 *   3. POST …/documents/{uuid}/complete/       -> the finalized Document
 *
 * The PUT is a plain `fetch` (not the axios client): the target may be
 * S3, it takes raw bytes not JSON, and it carries no session cookie —
 * the ticket URL *is* the authorization. A relative ticket URL (the
 * local storage backend) is resolved against the API origin.
 */
import { API_BASE_URL } from "../../api/client";
import { apiPost } from "../../api/request";
import type { DocumentRow, UploadTicket } from "./types";

const API_ORIGIN = new URL(API_BASE_URL, window.location.href).origin;

function absolute(url: string): string {
  return /^https?:\/\//i.test(url) ? url : new URL(url, API_ORIGIN).toString();
}

export class UploadError extends Error {}

export async function uploadImage(file: File): Promise<DocumentRow> {
  const issued = await apiPost<{ document: string; upload: UploadTicket }>(
    "/admin/documents/upload/",
    {
      category: "image",
      filename: file.name,
      size: file.size,
      content_type: file.type || "application/octet-stream",
      visibility: "public",
    },
  );

  const ticket = issued.upload;
  const put = await fetch(absolute(ticket.url), {
    method: ticket.method || "PUT",
    headers: ticket.headers,
    body: file,
  });
  if (!put.ok) {
    throw new UploadError(`Upload failed (${put.status}). The file may be too large or the link expired.`);
  }

  return apiPost<DocumentRow>(`/admin/documents/${issued.document}/complete/`);
}
