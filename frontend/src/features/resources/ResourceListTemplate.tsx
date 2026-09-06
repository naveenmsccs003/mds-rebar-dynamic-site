/**
 * Public resources list (spec §13). Restricted resources appear with a
 * badge; the actual file link for them is a signed URL resolved at
 * request time in Phase 10 — here the card links to `external_url` when
 * present and otherwise shows the restriction.
 */
import { PAGE_SIZE } from "../../api/request";
import { Container } from "../../components/Container/Container";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { PageState } from "../../components/PageState/PageState";
import { Pagination } from "../../components/Pagination/Pagination";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useListParams } from "../shared/useListParams";
import { useResources } from "./hooks";
import { RESOURCE_CATEGORIES } from "./types";

export function ResourceListTemplate() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = useResources(page > 1 ? { ...filterParams, page: String(page) } : filterParams);

  const filters: Filter[] = [
    {
      kind: "text",
      name: "q",
      label: "Search",
      value: get("q"),
      placeholder: "Title or description…",
      onChange: (v) => setParam("q", v),
    },
    {
      kind: "select",
      name: "category",
      label: "Category",
      value: get("category"),
      options: RESOURCE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
      onChange: (v) => setParam("category", v),
    },
  ];

  const categoryLabel = (value: string) =>
    RESOURCE_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  return (
    <>
      <SEOHead
        title="Resources"
        description="Brochures, technical documents, sample drawings, case studies and whitepapers from MDS Rebar."
        canonicalPath="/resources"
      />
      <Container as="header" className="page-header">
        <h1 className="page-header__title">Resources</h1>
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
              <span className="sr-only">Loading resources…</span>
              <Skeleton lines={6} />
            </div>
          </Container>
        }
        emptyState={
          <Container>
            <EmptyState title="No resources match those filters" />
          </Container>
        }
      >
        {(pageData) => (
          <Section>
            <ul className="cms-card-grid">
              {pageData.results.map((r) => (
                <li key={r.id} className="card">
                  <p className="card__eyebrow">
                    {categoryLabel(r.category)}
                    {r.access_type === "restricted" && (
                      <span className="badge badge--muted"> Restricted</span>
                    )}
                  </p>
                  <h2 className="card__title">{r.title}</h2>
                  {r.description && <p className="card__body">{r.description}</p>}
                  {r.external_url && (
                    <p>
                      <a href={r.external_url} target="_blank" rel="noopener noreferrer">
                        Open resource
                      </a>
                    </p>
                  )}
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
