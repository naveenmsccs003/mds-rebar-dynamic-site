import type { ReactNode } from "react";

import { Container } from "../Container/Container";

/**
 * A full-bleed page band with a contained inner column. `tone="dark"`
 * is the deep-navy high-contrast treatment (hero, CTA, "Why MDS") from
 * docs/UI_DESIGN_SYSTEM.md.
 */
export interface SectionProps {
  children: ReactNode;
  tone?: "default" | "muted" | "dark";
  /** Accessible label for the <section> landmark. */
  ariaLabel?: string;
  id?: string;
  containerSize?: "default" | "narrow" | "wide";
  className?: string;
}

export function Section({
  children,
  tone = "default",
  ariaLabel,
  id,
  containerSize = "default",
  className = "",
}: SectionProps) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={`section section--${tone} ${className}`.trim()}
    >
      <Container size={containerSize}>{children}</Container>
    </section>
  );
}
