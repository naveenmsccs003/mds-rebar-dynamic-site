/**
 * The single reusable service page (docs/UI_DESIGN_SYSTEM.md
 * "ServiceDetailTemplate"): breadcrumb → hero → overview → capabilities
 * → process → business value → technology → standards → deliverables →
 * output formats → FAQs → quote CTA. Every service — current or future —
 * renders through this from its DB record; there is never a page per
 * service (spec §10).
 */
import { Link, useParams } from "react-router-dom";

import { ApiRequestError } from "../../api/request";
import { Breadcrumbs } from "../../components/Breadcrumbs/Breadcrumbs";
import { Container } from "../../components/Container/Container";
import { PageState } from "../../components/PageState/PageState";
import { RichText } from "../../components/RichText/RichText";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { NotFoundPage } from "../../pages/NotFoundPage";
import { useService } from "./hooks";
import type { ServiceDetail } from "./types";

function TextBlock({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <div className={className}>
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function TextSection({ heading, text }: { heading: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <Section containerSize="narrow" ariaLabel={heading}>
      <h2 className="cms-section__heading">{heading}</h2>
      <TextBlock text={text} />
    </Section>
  );
}

function ServiceBody({ service }: { service: ServiceDetail }) {
  return (
    <>
      <SEOHead
        title={service.seo_title || service.name}
        description={service.seo_description || service.short_description || undefined}
        canonicalPath={`/services/${service.slug}`}
      />

      <Container as="header" className="page-header">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Services", to: "/services" },
            { label: service.name },
          ]}
        />
      </Container>

      <Section tone="dark" ariaLabel={service.name} containerSize="narrow" className="service-hero">
        <h1 className="cms-hero__heading">{service.name}</h1>
        {service.short_description && (
          <p className="cms-hero__subheading">{service.short_description}</p>
        )}
      </Section>

      {service.long_description && (
        <Section containerSize="narrow" ariaLabel="Overview">
          <RichText html={service.long_description} />
        </Section>
      )}

      {service.capabilities.length > 0 && (
        <Section tone="muted" ariaLabel="Capabilities">
          <h2 className="cms-section__heading">Capabilities</h2>
          <ul className="cms-card-grid">
            {service.capabilities.map((c) => (
              <li key={c.id} className="card">
                <h3 className="card__title">{c.title}</h3>
                {c.description && <p className="card__body">{c.description}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {service.process_steps.length > 0 && (
        <Section containerSize="narrow" ariaLabel="Our process">
          <h2 className="cms-section__heading">Our process</h2>
          <ol className="service-process">
            {service.process_steps.map((step) => (
              <li key={step.id}>
                <span className="service-process__num" aria-hidden="true">
                  {step.step_number}
                </span>
                <div>
                  <h3 className="service-process__title">{step.title}</h3>
                  {step.description && <p>{step.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <TextSection heading="Business value" text={service.business_value} />

      {service.technology.length > 0 && (
        <Section containerSize="narrow" ariaLabel="Technology">
          <h2 className="cms-section__heading">Technology</h2>
          <ul className="service-tech">
            {service.technology.map((t) => (
              <li key={t.id} className="badge">
                {t.name}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <TextSection heading="Standards & codes" text={service.standards_codes} />
      <TextSection heading="Deliverables" text={service.deliverables} />

      {service.output_formats.trim() && (
        <Section containerSize="narrow" ariaLabel="Output formats">
          <h2 className="cms-section__heading">Output formats</h2>
          <p>{service.output_formats}</p>
        </Section>
      )}

      {service.faqs.length > 0 && (
        <Section tone="muted" containerSize="narrow" ariaLabel="Frequently asked questions">
          <h2 className="cms-section__heading">FAQs</h2>
          <dl className="service-faqs">
            {service.faqs.map((f) => (
              <div key={f.id}>
                <dt>{f.question}</dt>
                <dd>{f.answer}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section tone="dark" containerSize="narrow" className="cms-cta" ariaLabel="Request a quote">
        <h2 className="cms-cta__heading">Need a quote for {service.name}?</h2>
        <p className="cms-cta__body">
          Tell us about your project and our team will get back to you.
        </p>
        <p className="cms-section__cta">
          <Link to="/request-quote" className="button button--primary">
            Request a Quote
          </Link>
        </p>
      </Section>
    </>
  );
}

export function ServiceDetailTemplate() {
  const { slug = "" } = useParams();
  const query = useService(slug);

  if (query.isError && query.error instanceof ApiRequestError && query.error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <PageState
      query={query}
      loadingState={
        <Container>
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading service…</span>
            <Skeleton lines={8} />
          </div>
        </Container>
      }
    >
      {(service) => <ServiceBody service={service} />}
    </PageState>
  );
}
