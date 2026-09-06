/**
 * The single reusable job posting page (spec §16 — one template renders
 * every posting from its DB record, never a page per job). Shows the
 * application form inline; a closed / past-deadline posting still
 * resolves here but the form is disabled with an explanation.
 */
import { useParams } from "react-router-dom";

import { ApiRequestError } from "../../api/request";
import { Breadcrumbs } from "../../components/Breadcrumbs/Breadcrumbs";
import { Container } from "../../components/Container/Container";
import { PageState } from "../../components/PageState/PageState";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { NotFoundPage } from "../../pages/NotFoundPage";

import { ApplicationForm } from "./ApplicationForm";
import { useJobPosting } from "./hooks";
import type { JobPostingDetail } from "./types";
import { EMPLOYMENT_TYPE_LABELS } from "./types";

function meta(job: JobPostingDetail): string {
  return [job.department, job.location, EMPLOYMENT_TYPE_LABELS[job.employment_type], job.experience]
    .filter(Boolean)
    .join(" · ");
}

function Prose({ heading, text }: { heading: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <>
      <h2 className="cms-section__heading">{heading}</h2>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </>
  );
}

function JobBody({ job }: { job: JobPostingDetail }) {
  const deadline = job.application_deadline
    ? new Date(job.application_deadline).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <>
      <SEOHead
        title={job.title}
        description={`${job.title} at MDS Rebar${job.location ? ` — ${job.location}` : ""}.`}
        canonicalPath={`/careers/${job.slug}`}
      />
      <Container as="header" className="page-header">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Careers", to: "/careers" },
            { label: job.title },
          ]}
        />
      </Container>

      <Section tone="dark" ariaLabel={job.title} containerSize="narrow">
        <h1 className="cms-hero__heading">{job.title}</h1>
        {meta(job) && <p className="cms-hero__subheading">{meta(job)}</p>}
      </Section>

      <Section containerSize="narrow" ariaLabel="Role details">
        {deadline && (
          <p className="list-count">
            {job.is_open ? `Apply by ${deadline}` : `Applications closed ${deadline}`}
          </p>
        )}
        <Prose heading="About the role" text={job.description} />
        <Prose heading="Responsibilities" text={job.responsibilities} />
        <Prose heading="Requirements" text={job.requirements} />
        <Prose heading="Benefits" text={job.benefits} />

        {job.skills_list.length > 0 && (
          <>
            <h2 className="cms-section__heading">Skills</h2>
            <ul className="service-tech">
              {job.skills_list.map((skill) => (
                <li key={skill} className="badge">
                  {skill}
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section tone="muted" containerSize="narrow" ariaLabel="Apply">
        {job.is_open ? (
          <ApplicationForm jobSlug={job.slug} />
        ) : (
          <p>This posting is no longer accepting applications.</p>
        )}
      </Section>
    </>
  );
}

export function JobDetailTemplate() {
  const { slug = "" } = useParams();
  const query = useJobPosting(slug);

  if (query.isError && query.error instanceof ApiRequestError && query.error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <PageState
      query={query}
      loadingState={
        <Container>
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading position…</span>
            <Skeleton lines={8} />
          </div>
        </Container>
      }
    >
      {(job) => <JobBody job={job} />}
    </PageState>
  );
}
