/**
 * Tiny field helpers for the catalogue admin forms. They operate on the
 * `values` / `set` pair `WorkflowResourcePage` (and the plain resource
 * forms) pass down. Relational fields are entered as a slug/id list
 * string until the A5 media picker / relation pickers land.
 */
import type { FieldErrors } from "../shared/publicForm";

export function Text({
  name,
  label,
  values,
  set,
  errors,
  type = "text",
}: {
  name: string;
  label: string;
  values: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  errors: FieldErrors;
  type?: string;
}) {
  return (
    <label className="form__field">
      <span>{label}</span>
      <input
        type={type}
        value={String(values[name] ?? "")}
        aria-invalid={errors[name] ? true : undefined}
        onChange={(e) => set(name, e.target.value)}
      />
      {errors[name] && <span className="form__error">{errors[name]}</span>}
    </label>
  );
}

export function Area({
  name,
  label,
  values,
  set,
  errors,
  rows = 5,
  hint,
}: {
  name: string;
  label: string;
  values: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  errors: FieldErrors;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="form__field">
      <span>{label}</span>
      {hint && <span className="admin-muted">{hint}</span>}
      <textarea
        rows={rows}
        value={String(values[name] ?? "")}
        aria-invalid={errors[name] ? true : undefined}
        onChange={(e) => set(name, e.target.value)}
      />
      {errors[name] && <span className="form__error">{errors[name]}</span>}
    </label>
  );
}

export function Bool({
  name,
  label,
  values,
  set,
}: {
  name: string;
  label: string;
  values: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <label className="form__field form__field--checkbox">
      <input type="checkbox" checked={!!values[name]} onChange={(e) => set(name, e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Select({
  name,
  label,
  options,
  values,
  set,
  errors,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  values: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  errors: FieldErrors;
}) {
  return (
    <label className="form__field">
      <span>{label}</span>
      <select value={String(values[name] ?? "")} onChange={(e) => set(name, e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors[name] && <span className="form__error">{errors[name]}</span>}
    </label>
  );
}
