/**
 * The concrete section renderers the homepage / about page compose from.
 * Each takes the raw CMS `content` object and reads it defensively via
 * `./content` helpers — the CMS owns the section schema, so an absent
 * field degrades gracefully rather than throwing.
 *
 * The set here is the Phase 5 core (hero, prose, CTA, card grid, stat
 * list). New `section_key`s added in the CMS render through
 * `FallbackSection` until a dedicated renderer is added.
 */
import { RichText } from "../../../components/RichText/RichText";
import { Section } from "../../../components/Section/Section";
import type { PageSectionContent } from "../types";
import { items, optionalStr, str } from "./content";
import { SmartLink } from "./SmartLink";

export interface SectionProps {
  content: PageSectionContent;
}

function SectionHeading({ content }: SectionProps) {
  const heading = optionalStr(content, "heading");
  const intro = optionalStr(content, "intro");
  if (!heading && !intro) return null;
  return (
    <header className="cms-section__head">
      {heading && <h2 className="cms-section__heading">{heading}</h2>}
      {intro && <p className="cms-section__intro">{intro}</p>}
    </header>
  );
}

function Cta({ label, href }: { label?: string; href?: string }) {
  if (!label || !href) return null;
  return (
    <p className="cms-section__cta">
      <SmartLink href={href} className="button button--primary">
        {label}
      </SmartLink>
    </p>
  );
}

export function HeroSection({ content }: SectionProps) {
  const heading = str(content, "heading", "MDS Rebar");
  const subheading = optionalStr(content, "subheading");
  const bodyHtml = optionalStr(content, "body_html");
  return (
    <Section tone="dark" ariaLabel={heading} containerSize="narrow" className="cms-hero">
      <h1 className="cms-hero__heading">{heading}</h1>
      {subheading && <p className="cms-hero__subheading">{subheading}</p>}
      {bodyHtml && <RichText html={bodyHtml} className="cms-hero__body" />}
      <Cta label={optionalStr(content, "cta_label")} href={optionalStr(content, "cta_href")} />
    </Section>
  );
}

export function ProseSection({ content }: SectionProps) {
  const bodyHtml = optionalStr(content, "body_html");
  if (!bodyHtml && !optionalStr(content, "heading")) return null;
  return (
    <Section containerSize="narrow" ariaLabel={optionalStr(content, "heading")}>
      <SectionHeading content={content} />
      {bodyHtml && <RichText html={bodyHtml} />}
    </Section>
  );
}

export function CtaSection({ content }: SectionProps) {
  const heading = optionalStr(content, "heading");
  const body = optionalStr(content, "body");
  return (
    <Section tone="dark" ariaLabel={heading ?? "Call to action"} containerSize="narrow" className="cms-cta">
      {heading && <h2 className="cms-cta__heading">{heading}</h2>}
      {body && <p className="cms-cta__body">{body}</p>}
      <Cta label={optionalStr(content, "cta_label")} href={optionalStr(content, "cta_href")} />
    </Section>
  );
}

export function CardGridSection({ content }: SectionProps) {
  const cards = items(content);
  if (cards.length === 0) return null;
  return (
    <Section tone="muted" ariaLabel={optionalStr(content, "heading")}>
      <SectionHeading content={content} />
      <ul className="cms-card-grid">
        {cards.map((c, i) => (
          <li key={`${c.title}-${i}`} className="card">
            {c.eyebrow && <p className="card__eyebrow">{c.eyebrow}</p>}
            <h3 className="card__title">
              {c.href ? <SmartLink href={c.href}>{c.title}</SmartLink> : c.title}
            </h3>
            {c.bodyHtml ? (
              <RichText html={c.bodyHtml} className="card__body" />
            ) : (
              c.body && <p className="card__body">{c.body}</p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function StatListSection({ content }: SectionProps) {
  const stats = items(content).filter((s) => s.label && s.value);
  if (stats.length === 0) return null;
  return (
    <Section ariaLabel={optionalStr(content, "heading") ?? "Key figures"}>
      <SectionHeading content={content} />
      <dl className="cms-stat-list">
        {stats.map((s, i) => (
          <div key={`${s.label}-${i}`} className="cms-stat">
            <dt className="cms-stat__value">{s.value}</dt>
            <dd className="cms-stat__label">{s.label}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function FallbackSection({ content }: SectionProps) {
  const heading = optionalStr(content, "heading");
  const bodyHtml = optionalStr(content, "body_html");
  const body = optionalStr(content, "body");
  if (!heading && !bodyHtml && !body) return null;
  return (
    <Section containerSize="narrow" ariaLabel={heading}>
      {heading && <h2 className="cms-section__heading">{heading}</h2>}
      {bodyHtml ? <RichText html={bodyHtml} /> : body && <p>{body}</p>}
    </Section>
  );
}
