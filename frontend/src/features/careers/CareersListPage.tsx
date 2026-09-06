/**
 * Public careers board — one card per open position (spec §16). Closed /
 * past-deadline postings are already filtered out server-side.
 */
import { PAGE_SIZE } from "../../api/request";
import { Card } from "../../components/Card/Card";
import { Container } from "../../components/Container/Container";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { PageState } from "../../components/PageState/PageState";
import { Pagination } from "../../components/Pagination/Pagination";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useListParams } from "../shared/useListParams";
import { useJobPostings } from "./hooks";
import { EMPLOYMENT_TYPE_LABELS } from "./types";

export function CareersListPage() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = useJobPostings(page > 1 ? { ...filterParams, page: String(page) } : filterParams);

  const filters: Filter[] = [
    {
      kind: "text",
      name: "q",
      label: "Search",
      value: get("q"),
      placeholder: "Role, skill…",
      onChange: (v) => setParam("q", v),
    },
    {
      kind: "text",
      name: "department",
      label: "Department",
      value: get("department"),
      placeholder: "e.g. Detailing",
      onChange: (v) => setParam("department", v),
    },
    {
      kind: "select",
      name: "employment_type",
      label: "Type",
      value: get("employment_type"),
      options: Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      onChange: (v) => setParam("employment_type", v),
    },
  ];

  return (
    <>
      <SEOHead
        title="Careers"
        description="Open positions at MDS Rebar — detailing, estimation, BIM coordination and more."
        canonicalPath="/careers"
      />
      <Container as="header" className="page-header">
        <h1 className="page-header__title">Careers</h1>
      </Container>

      <Container>
        <FilterBar filters={filters} />
      </Container>

      <PageState
        query={query}
        isEmpty={(p) => p.results.length === 0}
        loadingState={
          <Container>
            <div role="status" aria-live="polite">
              <span className="sr-only">Loading open positions…</span>
              <Skeleton lines={6} />
            </div>
          </Container>
        }
        emptyState={
          <Container>
            <EmptyState
              title="No open positions right now"
              description="Check back soon, or send your CV through our contact page."
            />
          </Container>
        }
      >
        {(pageData) => (
          <Section>
            <p className="list-count">
              {pageData.count} open {pageData.count === 1 ? "position" : "positions"}
            </p>
            <ul className="cms-card-grid">
              {pageData.results.map((job) => (
                <li key={job.id}>
                  <Card
                    title={job.title}
                    to={`/careers/${job.slug}`}
                    eyebrow={[
                      job.department,
                      job.location,
                      EMPLOYMENT_TYPE_LABELS[job.employment_type],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    {job.experience && <p className="card__body">Experience: {job.experience}</p>}
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageCount={Math.ceil(pageData.count / PAGE_SIZE)}
              onChange={setPage}
            />
          </Section>
        )}
      </PageState>
    </>
  );
}
