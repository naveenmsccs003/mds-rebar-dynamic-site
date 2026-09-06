/**
 * Service catalogue shapes from `GET /api/v1/services/` and
 * `/api/v1/services/{slug}/` (docs/API_DESIGN.md — Phase 6).
 */
export interface MediaRef {
  id: number;
  /** Signed URL to the underlying public file; `null` until the upload
   * has been scanned (docs/FILE_STORAGE.md). Render gracefully either way. */
  url: string | null;
  alt_text: string;
  caption: string;
  width: number | null;
  height: number | null;
}

export interface TechnologyRef {
  id: number;
  name: string;
  slug: string;
}

export interface ServiceCapability {
  id: number;
  title: string;
  description: string;
  display_order: number;
}

export interface ServiceProcessStep {
  id: number;
  title: string;
  description: string;
  step_number: number;
}

export interface ServiceFaq {
  id: number;
  question: string;
  answer: string;
  display_order: number;
}

export interface ServiceListItem {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  hero_image: MediaRef | null;
  icon: MediaRef | null;
  display_order: number;
}

export interface ServiceDetail extends ServiceListItem {
  long_description: string;
  og_image: MediaRef | null;
  business_value: string;
  standards_codes: string;
  deliverables: string;
  output_formats: string;
  technology: TechnologyRef[];
  capabilities: ServiceCapability[];
  process_steps: ServiceProcessStep[];
  faqs: ServiceFaq[];
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  updated_at: string;
}
