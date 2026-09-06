/**
 * Careers shapes from `GET /api/v1/careers/`, `/api/v1/careers/{slug}/`
 * and `POST /api/v1/career-applications/` (docs/API_DESIGN.md — Phase 8).
 */
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship";

export interface JobPostingListItem {
  id: number;
  title: string;
  slug: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  experience: string;
  application_deadline: string | null;
  is_open: boolean;
  created_at: string;
}

export interface JobPostingDetail extends JobPostingListItem {
  skills: string;
  skills_list: string[];
  description: string;
  responsibilities: string;
  requirements: string;
  benefits: string;
  updated_at: string;
}

export interface ApplicationInput {
  job: string;
  name: string;
  email: string;
  phone: string;
  cover_letter: string;
  resume: File;
}

export interface ApplicationResult {
  reference: string | null;
  status: string | null;
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};
