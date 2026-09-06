/**
 * The single reusable project page (docs/UI_DESIGN_SYSTEM.md
 * "PortfolioDetailTemplate"). Every project renders through this from
 * its DB record.
 */
import { Link, useParams } from "react-router-dom";

import { ApiRequestError } from "../../api/request";
import { Breadcrumbs } from "../../components/Breadcrumbs/Breadcrumbs";
import { Container } from "../../components/Container/Container";
import { MediaImage } from "../../components/MediaImage/MediaImage";
import { PageState } from "../../components/PageState/PageState";
import { RichText } from "../../components/RichText/RichText";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { NotFoundPage } from "../../pages/NotFoundPage";
import { useProject } from "./hooks";
import type { ProjectDetail } from "./types";

function meta(p: ProjectDetail): string {
  return [p.category, p.completion_year, p.country?.name, p.client_industry?.name]
    .filter(Boolean)
    .join(" · ");
}

function ProjectBody({ project }: { project: ProjectDetail }) {
  return (
    <>
      <SEOHead
        title={project.seo_title || project.title}
        description={project.seo_description || undefined}
        canonicalPath={`/portfolio/${project.slug}`}
      />
      <Container as="header" className="page-header">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Portfolio", to: "/portfolio" },
            { label: project.title },
          ]}
        />
      </Container>

      <Section tone="dark" ariaLabel={project.title} containerSize="narrow">
        <h1 className="cms-hero__heading">{project.title}</h1>
        {meta(project) && <p className="cms-hero__subheading">{meta(project)}</p>}
      </Section>

      {project.description && (
        <Section containerSize="narrow" ariaLabel="Overview">
          <RichText html={project.description} />
        </Section>
      )}

      {project.images.length > 0 && (
        <Section ariaLabel="Project images">
          <ul className="project-gallery">
            {project.images.map((img, i) => (
              <li key={i} className="project-gallery__item">
                <MediaImage media={img.image} fallbackAlt="Project image" />
                {img.image.caption && <p className="project-gallery__caption">{img.image.caption}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(project.services.length > 0 || project.technology.length > 0) && (
        <Section containerSize="narrow" ariaLabel="Services and technology">
          {project.services.length > 0 && (
            <>
              <h2 className="cms-section__heading">Services</h2>
              <ul className="service-tech">
                {project.services.map((s) => (
                  <li key={s.id} className="badge">
                    <Link to={`/services/${s.slug}`}>{s.name}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {project.technology.length > 0 && (
            <>
              <h2 className="cms-section__heading">Technology</h2>
              <ul className="service-tech">
                {project.technology.map((t) => (
                  <li key={t.id} className="badge">
                    {t.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      {project.documents.length > 0 && (
        <Section containerSize="narrow" ariaLabel="Documents">
          <h2 className="cms-section__heading">Documents</h2>
          <ul>
            {project.documents.map((d) => (
              <li key={d.id}>{d.label || "Document"}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section tone="dark" containerSize="narrow" className="cms-cta" ariaLabel="Request a quote">
        <h2 className="cms-cta__heading">Have a similar project?</h2>
        <p className="cms-section__cta">
          <Link to="/request-quote" className="button button--primary">
            Request a Quote
          </Link>
        </p>
      </Section>
    </>
  );
}

export function PortfolioDetailTemplate() {
  const { slug = "" } = useParams();
  const query = useProject(slug);

  if (query.isError && query.error instanceof ApiRequestError && query.error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <PageState
      query={query}
      loadingState={
        <Container>
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading project…</span>
            <Skeleton lines={8} />
          </div>
        </Container>
      }
    >
      {(project) => <ProjectBody project={project} />}
    </PageState>
  );
}
