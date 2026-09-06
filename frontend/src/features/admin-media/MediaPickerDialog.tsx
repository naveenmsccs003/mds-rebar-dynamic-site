/**
 * "Choose an image" — a drawer over whatever form opened it. Lists the
 * media library (searchable, paginated) as a thumbnail grid; picking one
 * (or uploading a new one) calls `onSelect` with the asset and closes.
 */
import { useState } from "react";

import { PAGE_SIZE } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { ErrorState } from "../../components/ErrorState/ErrorState";
import { Pagination } from "../../components/Pagination/Pagination";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { usePermission } from "../auth/usePermission";
import { media } from "./hooks";
import { UploadForm } from "./UploadForm";
import type { MediaAssetRow } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAssetRow) => void;
}

export function MediaPickerDialog({ open, onClose, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const canAdd = usePermission("media.add_mediaasset");

  const params: Record<string, string> = {};
  if (search.trim()) params.search = search.trim();
  if (page > 1) params.page = String(page);
  const query = media.useList(params);

  function choose(asset: MediaAssetRow) {
    onSelect(asset);
    onClose();
  }

  return (
    <FormDrawer open={open} title="Choose an image" onClose={onClose}>
      <div className="admin-form-stack">
        {canAdd && (
          <section className="admin-panel" aria-label="Upload a new image">
            <h3>
              <button
                type="button"
                className="button button--ghost"
                aria-expanded={showUpload}
                onClick={() => setShowUpload((s) => !s)}
              >
                {showUpload ? "▾" : "▸"} Upload a new image
              </button>
            </h3>
            {showUpload && <UploadForm onUploaded={choose} />}
          </section>
        )}

        <label className="form__field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Alt text or caption"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>

        {query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : query.isPending || !query.data ? (
          <Skeleton lines={6} />
        ) : query.data.results.length === 0 ? (
          <p className="admin-muted">No images match.</p>
        ) : (
          <>
            <ul className="media-grid">
              {query.data.results.map((asset) => (
                <li key={asset.id}>
                  <button type="button" className="media-card" onClick={() => choose(asset)}>
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
            <Pagination
              page={page}
              pageCount={Math.ceil(query.data.count / PAGE_SIZE)}
              onChange={setPage}
            />
          </>
        )}

        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </FormDrawer>
  );
}
