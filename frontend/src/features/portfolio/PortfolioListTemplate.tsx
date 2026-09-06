/**
 * Public portfolio list (spec §12) — always server-filtered + paginated;
 * the full project table never reaches the browser. Filters + page live
 * in the URL (`useListParams`).
 */
import { Card } from "../../components/Card/Card";
import { Container } from "../../components/Container/Container";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { PageState } from "../../components/PageState/PageState";
import { Pagination } from "../../components/Pagination/Pagination";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { PAGE_SIZE } from "../../api/request";
import { useServices } from "../services/hooks";
import { useListParams } from "../shared/useListParams";
import { useProjects } from "./hooks";

export function PortfolioListTemplate() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const { data: services = [] } = useServices();
  const query = useProjects(page > 1 ? { ...filterParams, page } : filterParams);

  const filters: Filter[] = [
    {
      kind: "text",
      name: "q",
      label: "Search",
      value: get("q"),
      placeholder: "Project, category…",
      onChange: (v) => setParam("q", v),
    },
    {
      kind: "select",
      name: "service",
      label: "Service",
      value: get("service"),
      options: services.map((s) => ({ value: s.slug, label: s.name })),
      onChange: (v) => setParam("service", v),
    },
    {
      kind: "text",
      name: "year",
      label: "Year",
      value: get("year"),
      placeholder: "e.g. 2025",
      onChange: (v) => setParam("year", v.replace(/\D/g, "")),
    },
    {
      kind: "checkbox",
      name: "featured",
      label: "Featured only",
      checked: get("featured") === "true",
      onChange: (checked) => setParam("featured", checked ? "true" : ""),
    },
  ];

  return (
    <>
      <SEOHead
        title="Portfolio"
        description="Selected MDS Rebar projects — rebar detailing and construction engineering across sectors and regions."
        canonicalPath="/portfolio"
      />
      <Container as="header" className="page-header">
        <h1 className="page-header__title">Portfolio</h1>
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
              <span className="sr-only">Loading projects…</span>
              <Skeleton lines={6} />
            </div>
          </Container>
        }
        emptyState={
          <Container>
            <EmptyState
              title="No projects match those filters"
              description="Try clearing a filter, or check back later."
            />
          </Container>
        }
      >
        {(pageData) => (
          <Section>
            <p className="list-count">{pageData.count} project{pageData.count === 1 ? "" : "s"}</p>
            <ul className="cms-card-grid">
              {pageData.results.map((p) => (
                <li key={p.id}>
                  <Card
                    title={p.title}
                    to={`/portfolio/${p.slug}`}
                    eyebrow={[p.category, p.completion_year].filter(Boolean).join(" · ")}
                  >
                    {p.country && <p className="card__body">{p.country.name}</p>}
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
