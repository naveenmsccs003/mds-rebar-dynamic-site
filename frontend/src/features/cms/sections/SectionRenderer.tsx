/**
 * Renders a CMS page's sections in the order the API returns them
 * (docs/UI_DESIGN_SYSTEM.md — "Homepage section order (data-driven,
 * never hardcoded)": editors reorder/hide sections from the CMS without
 * a frontend deploy). `section_key` selects the renderer; an unknown key
 * degrades to `FallbackSection` rather than breaking the page.
 */
import type { ComponentType } from "react";

import type { PageSection, PageSections } from "../types";
import {
  CardGridSection,
  CtaSection,
  FallbackSection,
  HeroSection,
  ProseSection,
  type SectionProps,
  StatListSection,
} from "./sections";

const REGISTRY: Record<string, ComponentType<SectionProps>> = {
  hero: HeroSection,
  prose: ProseSection,
  rich_text: ProseSection,
  text: ProseSection,
  cta: CtaSection,
  call_to_action: CtaSection,
  card_grid: CardGridSection,
  feature_grid: CardGridSection,
  cards: CardGridSection,
  stat_list: StatListSection,
  stats: StatListSection,
};

function renderSection(section: PageSection) {
  const Renderer = REGISTRY[section.section_key] ?? FallbackSection;
  return <Renderer key={section.section_key} content={section.content} />;
}

export function SectionRenderer({ sections }: { sections: PageSections }) {
  const ordered = [...sections].sort((a, b) => a.display_order - b.display_order);
  return <>{ordered.map(renderSection)}</>;
}
