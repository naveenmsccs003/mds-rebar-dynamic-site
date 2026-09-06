/** `POST /api/v1/contact/` (docs/API_DESIGN.md — Phase 9). */
export type EnquiryType = "contact" | "business";

export interface EnquiryInput {
  enquiry_type: EnquiryType;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
}

export interface EnquiryResult {
  reference: string | null;
  status: string | null;
}
