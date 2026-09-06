/**
 * A form field that holds a `MediaAsset` id. Shows the current pick as a
 * thumbnail; "Choose" opens `MediaPickerDialog`. Drop-in for the numeric
 * image-FK inputs the catalogue forms used before the library existed —
 * pass the current value and an `onChange(id | null)`.
 */
import { useState } from "react";

import type { FieldErrors } from "../shared/publicForm";
import { useMediaAsset } from "./hooks";
import { MediaPickerDialog } from "./MediaPickerDialog";

interface Props {
  name: string;
  label: string;
  value: number | null;
  onChange: (id: number | null) => void;
  errors?: FieldErrors;
  hint?: string;
}

export function MediaPicker({ name, label, value, onChange, errors = {}, hint }: Props) {
  const [open, setOpen] = useState(false);
  const asset = useMediaAsset(value);
  const err = errors[name];

  return (
    <div className="form__field">
      <span id={`${name}-label`}>{label}</span>
      {hint && <span className="admin-muted">{hint}</span>}

      <div className="media-picker" role="group" aria-labelledby={`${name}-label`}>
        {value != null && asset.data?.url ? (
          <img className="media-picker__thumb" src={asset.data.url} alt={asset.data.alt_text} />
        ) : (
          <span className="media-picker__thumb media-picker__thumb--empty">
            {value == null ? "No image" : asset.isPending ? "…" : `#${value}`}
          </span>
        )}
        <div className="media-picker__actions">
          <button type="button" className="button button--secondary" onClick={() => setOpen(true)}>
            {value == null ? "Choose image" : "Change"}
          </button>
          {value != null && (
            <button
              type="button"
              className="button button--ghost"
              onClick={() => onChange(null)}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {asset.data?.alt_text && value != null && (
        <span className="admin-muted">{asset.data.alt_text}</span>
      )}
      {err && <span className="form__error">{err}</span>}

      <MediaPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(picked) => onChange(picked.id)}
      />
    </div>
  );
}
