import type { PublishStatus } from "../admin-cms/types";

interface WorkflowFields {
  id: number;
  status: PublishStatus;
  allowed_transitions: string[];
  created_at: string;
  updated_at: string;
}

export interface ServiceRow extends WorkflowFields {
  name: string;
  slug: string;
  short_description: string;
  long_description: string;
  business_value: string;
  standards_codes: string;
  deliverables: string;
  output_formats: string;
  display_order: number;
  hero_image: number | null;
  icon: number | null;
  og_image: number | null;
  technology: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
}

export interface ProjectRow extends WorkflowFields {
  title: string;
  slug: string;
  category: string;
  description: string;
  completion_year: number | null;
  is_featured: boolean;
  country: number | null;
  client_industry: number | null;
  services: string[];
  technology: string[];
  seo_title: string;
  seo_description: string;
  og_image: number | null;
}

export interface NewsRow extends WorkflowFields {
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  featured_image: number | null;
  tags: number[];
  author_name: string;
  publish_date: string | null;
  scheduled_publish_at: string | null;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  og_title: string;
  og_description: string;
  og_image: number | null;
  canonical_url: string;
}

export interface ResourceRow {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  file: number | null;
  thumbnail: number | null;
  external_url: string;
  access_type: "public" | "restricted";
  published_date: string | null;
  is_published: boolean;
  download_count: number;
  seo_title: string;
  seo_description: string;
}

export interface CareersRow {
  id: number;
  title: string;
  slug: string;
  department: string;
  location: string;
  employment_type: "full_time" | "part_time" | "contract" | "internship";
  experience: string;
  skills: string;
  description: string;
  responsibilities: string;
  requirements: string;
  benefits: string;
  application_deadline: string | null;
  is_active: boolean;
}
