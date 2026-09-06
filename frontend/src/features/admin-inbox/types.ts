/**
 * Row shapes for the admin Inbox — quote requests, enquiries, and job
 * applications. Everything the public submitter sent is read-only in
 * these APIs; only `status` and `assigned_to` move (docs/API_DESIGN.md
 * §16–18). `allowed_transitions` comes from `apps.enquiries.lifecycle`
 * for the two lead types; applications use their own flat status set.
 */

/** Shared lead lifecycle (`apps.enquiries.lifecycle`). */
export type LeadStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "responded"
  | "closed"
  | "spam";

interface LeadFields {
  id: number;
  public_reference: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  allowed_transitions: LeadStatus[];
  assigned_to: number | null;
  assigned_to_email: string;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

export interface QuoteRequestRow extends LeadFields {
  company: string;
  country_code: string;
  service_slug: string;
  required_service_slugs: string[];
  project_type: string;
  project_location: string;
  project_size: string;
  timeline: string;
  message: string;
  updated_at: string;
}

export interface EnquiryNote {
  id: number;
  note: string;
  author: number | null;
  author_email: string;
  created_at: string;
}

export interface EnquiryRow extends LeadFields {
  enquiry_type: "contact" | "business";
  company: string;
  message: string;
  notes: EnquiryNote[];
}

export type ApplicationStatus =
  | "new"
  | "reviewing"
  | "shortlisted"
  | "rejected"
  | "hired";

export interface ApplicationRow {
  id: number;
  uuid: string;
  job: number;
  job_title: string;
  job_slug: string;
  name: string;
  email: string;
  phone: string;
  cover_letter: string;
  additional_info: string;
  resume: number | null;
  resume_filename: string;
  resume_status: string;
  status: ApplicationStatus;
  assigned_to: number | null;
  assigned_to_email: string;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}
