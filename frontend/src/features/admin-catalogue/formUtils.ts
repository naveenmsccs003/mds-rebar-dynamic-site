/** Pure helpers for the catalogue admin forms (kept out of the .tsx so
 * Fast Refresh only sees components there). */

/** Comma-separated string in the field <-> string[] in the body. */
export function csvToList(v: unknown): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listToCsv(v: unknown): string {
  return Array.isArray(v) ? v.join(", ") : "";
}

/** number-or-blank string in the field <-> number|null in the body. */
export function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return String(v ?? "").trim() === "" || Number.isNaN(n) ? null : n;
}
