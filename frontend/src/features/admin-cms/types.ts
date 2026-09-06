export type PublishStatus = "draft" | "review" | "approved" | "published" | "archived";

export interface PageSectionRow {
  id: number;
  page_key: string;
  section_key: string;
  display_order: number;
  content: Record<string, unknown>;
  status: PublishStatus;
  allowed_transitions: string[];
  published_at: string | null;
  scheduled_publish_at: string | null;
  current_version: number | null;
  updated_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface PageSectionWrite {
  page_key: string;
  section_key: string;
  display_order: number;
  content: Record<string, unknown>;
  scheduled_publish_at?: string | null;
}

export type SettingValueType = "text" | "number" | "boolean" | "json";
export interface SiteSettingRow {
  id: number;
  key: string;
  value: string;
  value_type: SettingValueType;
  description: string;
}

export interface TagRow {
  id: number;
  name: string;
  slug: string;
}

export interface RedirectRow {
  id: number;
  old_path: string;
  new_path: string;
  is_permanent: boolean;
  note: string;
  created_at: string;
}
