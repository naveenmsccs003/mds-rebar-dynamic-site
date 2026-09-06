import type { MediaRef, TechnologyRef } from "../services/types";

export interface CountryRef {
  id: number;
  name: string;
  code: string;
}

export interface IndustryRef {
  id: number;
  name: string;
  slug: string;
}

export interface ProjectListItem {
  id: number;
  title: string;
  slug: string;
  category: string;
  completion_year: number | null;
  is_featured: boolean;
  country: CountryRef | null;
  client_industry: IndustryRef | null;
  og_image: MediaRef | null;
  cover_image: MediaRef | null;
}

export interface ProjectImage {
  image: MediaRef;
  display_order: number;
}

export interface ProjectDocument {
  id: number;
  label: string;
  is_public: boolean;
}

export interface ProjectDetail extends ProjectListItem {
  description: string;
  services: TechnologyRef[];
  technology: TechnologyRef[];
  images: ProjectImage[];
  documents: ProjectDocument[];
  seo_title: string;
  seo_description: string;
  updated_at: string;
}
