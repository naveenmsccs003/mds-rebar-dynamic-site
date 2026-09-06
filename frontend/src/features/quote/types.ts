/** `POST /api/v1/quote-requests/` (docs/API_DESIGN.md — Phase 9). */
export interface QuoteInput {
  name: string;
  company: string;
  email: string;
  phone: string;
  service: string | null;
  project_type: string;
  project_location: string;
  project_size: string;
  timeline: string;
  message: string;
}

export interface QuoteResult {
  reference: string | null;
  status: string | null;
}
