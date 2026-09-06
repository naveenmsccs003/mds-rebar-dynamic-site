import { apiPost } from "../../api/request";
import type { QuoteInput, QuoteResult } from "./types";

export function submitQuoteRequest(input: QuoteInput): Promise<QuoteResult> {
  // Drop the optional service key entirely when unset so the backend
  // doesn't try to resolve an empty slug.
  const body: Record<string, unknown> = { ...input };
  if (!input.service) delete body.service;
  return apiPost<QuoteResult>("/quote-requests/", body);
}
