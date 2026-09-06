/**
 * Upload a new image → `MediaAsset`. Shared by the library page and the
 * picker dialog. Alt text is required here (it's required for any
 * published use — docs/UI_DESIGN_SYSTEM.md accessibility).
 */
import { useState } from "react";

import { ApiRequestError } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { useUploadMedia } from "./hooks";
import type { MediaAssetRow } from "./types";
import { UploadError } from "./upload";

const MAX_BYTES = 10 * 1024 * 1024;

export function UploadForm({ onUploaded }: { onUploaded: (asset: MediaAssetRow) => void }) {
  const upload = useUploadMedia();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!file) return setLocalError("Choose an image file.");
    if (file.size > MAX_BYTES) return setLocalError("Image must be 10 MB or smaller.");
    if (!alt.trim()) return setLocalError("Alt text is required.");
    upload.mutate(
      { file, alt_text: alt.trim(), caption: caption.trim() },
      {
        onSuccess: (asset) => {
          setFile(null);
          setAlt("");
          setCaption("");
          onUploaded(asset);
        },
      },
    );
  }

  const serverError =
    upload.error instanceof ApiRequestError || upload.error instanceof UploadError
      ? upload.error.message
      : upload.error
        ? "Upload failed. Please try again."
        : null;

  return (
    <form className="form" onSubmit={submit}>
      <label className="form__field">
        <span>Image file</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <label className="form__field">
        <span>Alt text</span>
        <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={255} />
      </label>
      <label className="form__field">
        <span>Caption (optional)</span>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={255} />
      </label>
      {(localError || serverError) && (
        <p className="form__error" role="alert">
          {localError ?? serverError}
        </p>
      )}
      <Button type="submit" disabled={upload.isPending}>
        {upload.isPending ? "Uploading…" : "Upload image"}
      </Button>
    </form>
  );
}
