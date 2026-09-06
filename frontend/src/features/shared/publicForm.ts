/**
 * Shared helpers for the public submission forms (careers application,
 * contact, request-a-quote). The backend returns field errors under
 * `error.fields` and a form-level message under `error.message`
 * (docs/API_DESIGN.md envelope); these turn an `ApiRequestError` into the
 * shapes a form renders.
 */
import { ApiRequestError } from "../../api/request";

export type FieldErrors = Record<string, string>;

/** Per-field messages from a failed submission, `{}` for anything else. */
export function fieldErrorsFromApi(error: unknown): FieldErrors {
  if (!(error instanceof ApiRequestError)) return {};
  return Object.fromEntries(
    Object.entries(error.fields).map(([field, messages]) => [field, messages.join(" ")]),
  );
}

/** A form-level message when the failure has no per-field detail. */
export function formErrorFromApi(error: unknown): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined;
  return Object.keys(error.fields).length === 0 ? error.message : undefined;
}
