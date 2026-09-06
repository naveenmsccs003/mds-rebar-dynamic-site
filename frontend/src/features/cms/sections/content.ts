/**
 * Small typed accessors for the loosely-shaped `PageSection.content`
 * JSON. The CMS owns the section schema, so the frontend reads
 * defensively — a missing / wrong-typed key yields a sensible default,
 * never a runtime crash.
 */
import type { PageSectionContent } from "../types";

export function str(content: PageSectionContent, key: string, fallback = ""): string {
  const v = content[key];
  return typeof v === "string" ? v : fallback;
}

export function optionalStr(content: PageSectionContent, key: string): string | undefined {
  const v = content[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export interface ContentItem {
  title: string;
  body?: string;
  bodyHtml?: string;
  href?: string;
  eyebrow?: string;
  label?: string;
  value?: string;
}

export function items(content: PageSectionContent, key = "items"): ContentItem[] {
  const raw = content[key];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      title: typeof r.title === "string" ? r.title : "",
      body: typeof r.body === "string" ? r.body : undefined,
      bodyHtml: typeof r.body_html === "string" ? r.body_html : undefined,
      href: typeof r.href === "string" ? r.href : undefined,
      eyebrow: typeof r.eyebrow === "string" ? r.eyebrow : undefined,
      label: typeof r.label === "string" ? r.label : undefined,
      value: typeof r.value === "string" ? r.value : undefined,
    }));
}
