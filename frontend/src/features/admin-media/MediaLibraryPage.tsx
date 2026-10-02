/**
 * Library → Media. The image library behind `MediaPicker`: a searchable,
 * paginated thumbnail grid; upload new images; edit alt text / caption
 * or delete an asset (docs/API_DESIGN.md — `media.*_mediaasset`).
 */
import { useState } from "react";

import { ApiRequestError, PAGE_SIZE } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { ErrorState } from "../../components/ErrorState/ErrorState";
import { Pagination } from "../../components/Pagination/Pagination";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { useListParams } from "../shared/useListParams";
import { usePermission } from "../auth/usePermission";
import { media } from "./hooks";
import { UploadForm } from "./UploadForm";
import type { MediaAssetRow } from "./types";

function EditForm({ asset, onDone }: { asset: MediaAssetRow; onDone: () => void }) {
  const update = media.useUpdate();
  const remove = media.useRemove();
  const canChange = usePermission("media.change_mediaasset");
  const canDelete = usePermission("media.delete_mediaasset");
  const [alt, setAlt] = useState(asset.alt_text);
  const [caption, setCaption] = useState(asset.caption);
  const [confirming, setConfirming] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      { id: asset.id, body: { alt_text: alt, caption } },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="admin-form-stack">
      {asset.url && <img className="media-detail__preview" src={asset.url} alt={asset.alt_text} />}
      <form className="form" onSubmit={submit}>
        <p className="admin-muted">
          Document #{asset.document} · {asset.document_status}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
        </p>
        <label className="form__field">
          <span>Alt text</span>
          <input value={alt} disabled={!canChange} onChange={(e) => setAlt(e.target.value)} maxLength={255} />
        </label>
        <label className="form__field">
          <span>Caption</span>
          <input
            value={caption}
            disabled={!canChange}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={255}
          />
        </label>
        {update.error instanceof ApiRequestError && (
          <p className="form__error" role="alert">
            {update.error.message}
          </p>
        )}
        <Button type="submit" disabled={!canChange || update.isPending}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </form>

      {canDelete && (
        <section className="admin-panel" aria-label="Delete">
          <h3>Delete</h3>
          <p className="admin-muted">
            Removes the asset and its file. Content still pointing at it will lose its image.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="button--danger"
            onClick={() => setConfirming(true)}
          >
            Delete image
          </Button>
        </section>
      )}
      <ConfirmDialog
        open={confirming}
        title="Delete this image?"
        body={asset.alt_text || `Asset #${asset.id}`}
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => remove.mutate(asset.id, { onSuccess: onDone })}
      />
    </div>
  );
}

export function MediaLibraryPage() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = media.useList(page > 1 ? { ...filterParams, page: String(page) } : filterParams);
  const canAdd = usePermission("media.add_mediaasset");
  const [editing, setEditing] = useState<MediaAssetRow | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  return (
    <>
      <SEOHead title="Media library" noindex />
      <h1>Media library</h1>

      <div className="admin-table__toolbar">
        <div className="admin-table__toolbar-row">
          <label className="filter-bar__field">
            <span>Search</span>
            <input
              type="search"
              value={get("search")}
              placeholder="Alt text or caption"
              onChange={(e) => setParam("search", e.target.value)}
            />
          </label>
          {canAdd && (
            <Button type="button" onClick={() => setUploading(true)}>
              Upload image
            </Button>
          )}
        </div>
      </div>

      {query.isError ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => query.refetch()}
        />
      ) : query.isPending || !query.data ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading…</span>
          <Skeleton lines={8} />
        </div>
      ) : query.data.results.length === 0 ? (
        <p className="admin-muted">No images yet.</p>
      ) : (
        <>
          <ul className="media-grid">
            {query.data.results.map((asset) => (
              <li key={asset.id}>
                <button type="button" className="media-card" onClick={() => setEditing(asset)}>
                  {asset.url ? (
                    <img className="media-card__thumb" src={asset.url} alt={asset.alt_text} />
                  ) : (
                    <span className="media-card__thumb media-card__thumb--empty">scanning…</span>
                  )}
                  <span className="media-card__label">{asset.alt_text || `#${asset.id}`}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="admin-table__footer">
            <p className="admin-muted">{query.data.count} total</p>
            <Pagination
              page={page}
              pageCount={Math.ceil(query.data.count / PAGE_SIZE)}
              onChange={setPage}
            />
          </div>
        </>
      )}

      <FormDrawer open={uploading} title="Upload image" onClose={() => setUploading(false)}>
        {uploading && <UploadForm onUploaded={() => setUploading(false)} />}
      </FormDrawer>
      <FormDrawer
        open={editing !== undefined}
        title={editing ? editing.alt_text || `Asset #${editing.id}` : ""}
        onClose={() => setEditing(undefined)}
      >
        {editing && <EditForm asset={editing} onDone={() => setEditing(undefined)} />}
      </FormDrawer>
    </>
  );
}
