/**
 * A row of labelled controls above a list (docs/UI_DESIGN_SYSTEM.md
 * FilterBar). Each field is a proper `<label>`-wrapped control; the bar
 * itself is a `<search>`-role region so assistive tech can jump to it.
 */
import type { ReactNode } from "react";

export interface SelectFilter {
  kind: "select";
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export interface TextFilter {
  kind: "text";
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export interface CheckboxFilter {
  kind: "checkbox";
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export type Filter = SelectFilter | TextFilter | CheckboxFilter;

function Field({ filter }: { filter: Filter }) {
  if (filter.kind === "select") {
    return (
      <label className="filter-bar__field">
        <span>{filter.label}</span>
        <select value={filter.value} onChange={(e) => filter.onChange(e.target.value)}>
          <option value="">All</option>
          {filter.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (filter.kind === "checkbox") {
    return (
      <label className="filter-bar__field filter-bar__field--checkbox">
        <input
          type="checkbox"
          checked={filter.checked}
          onChange={(e) => filter.onChange(e.target.checked)}
        />
        <span>{filter.label}</span>
      </label>
    );
  }
  return (
    <label className="filter-bar__field">
      <span>{filter.label}</span>
      <input
        type="search"
        value={filter.value}
        placeholder={filter.placeholder}
        onChange={(e) => filter.onChange(e.target.value)}
      />
    </label>
  );
}

export function FilterBar({ filters, children }: { filters: Filter[]; children?: ReactNode }) {
  return (
    <div role="search" aria-label="Filters" className="filter-bar">
      {filters.map((f) => (
        <Field key={f.name} filter={f} />
      ))}
      {children}
    </div>
  );
}
