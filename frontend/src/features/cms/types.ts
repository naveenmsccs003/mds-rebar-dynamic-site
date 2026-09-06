/**
 * Public CMS content shapes returned by `GET /api/v1/pages/{page_key}/`
 * (docs/API_DESIGN.md — Phase 4 CMS). Only the published, render-facing
 * fields; the admin/workflow fields never reach the public API.
 */
export interface PageSectionContent {
  /** Section-specific structured fields. Rich-text values live at
   * `*_html` keys and are already sanitised server-side. */
  [key: string]: unknown;
}

export interface PageSection {
  section_key: string;
  display_order: number;
  content: PageSectionContent;
  published_at: string | null;
}

export type PageSections = PageSection[];
