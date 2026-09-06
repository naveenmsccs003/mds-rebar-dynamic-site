import type { MediaRef } from "../services/types";

export const RESOURCE_CATEGORIES = [
  { value: "brochure", label: "Brochure" },
  { value: "video", label: "Video" },
  { value: "sample_drawing", label: "Sample Drawing" },
  { value: "technical_document", label: "Technical Document" },
  { value: "case_study", label: "Case Study" },
  { value: "whitepaper", label: "Whitepaper" },
] as const;

export interface ResourceListItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  access_type: "public" | "restricted";
  published_date: string | null;
  external_url: string;
  thumbnail: MediaRef | null;
}
