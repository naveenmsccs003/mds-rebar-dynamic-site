/**
 * Media library types (docs/API_DESIGN.md, docs/FILE_STORAGE.md).
 *
 * A `MediaAsset` is display metadata (alt text, caption, dimensions)
 * around a *public* `documents.Document`. The file goes through the
 * declared-upload flow first (`upload.ts`); the asset then links to it
 * by Document pk.
 */

export interface MediaAssetRow {
  id: number;
  document: number;
  document_status: string;
  /** Resolved public URL, or `null` while the scan is still pending. */
  url: string | null;
  alt_text: string;
  caption: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface MediaAssetWrite {
  document: number;
  alt_text: string;
  caption: string;
  width: number | null;
  height: number | null;
}

/** `data.upload` from `POST /api/v1/admin/documents/upload/`. */
export interface UploadTicket {
  url: string;
  method: string;
  headers: Record<string, string>;
  expires_in: number;
}

/** `DocumentSerializer` — what `…/documents/{uuid}/complete/` returns. */
export interface DocumentRow {
  id: number;
  uuid: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  visibility: string;
  status: string;
}
