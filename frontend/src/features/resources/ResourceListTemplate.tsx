/**
 * Public resources list (spec §13). A resource with a file gets a
 * Download action that resolves a short-lived signed URL at click time
 * (docs/FILE_STORAGE.md); a `restricted` resource needs a signed-in
 * Knowledge Base account and returns 403 otherwise.
 */
import { PAGE_SIZE } from "../../api/request";
import { ApiRequestError } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { Container } from "../../components/Container/Container";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { PageState } from "../../components/PageState/PageState";
import { Pagination } from "../../components/Pagination/Pagination";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useListParams } from "../shared/useListParams";
import { useResourceDownload, useResources } from "./hooks";
import { RESOURCE_CATEGORIES, type ResourceListItem } from "./types";

const categoryLabel = (value: string) =>
  RESOURCE_CATEGORIES.find((c) => c.value === value)?.label ?? value;

function DownloadButton({ resource }: { resource: ResourceListItem }) {
  const download = useResourceDownload();

  function onClick() {
    download.mutate(resource.slug, {
      onSuccess: ({ url }) => window.location.assign(url),
    });
  }

  const message =
    download.error instanceof ApiRequestError
      ? download.error.status === 403
        ? "Sign in to a Knowledge Base account to download this."
        : download.error.message
      : undefined;

  return (
    <p>
      <Button variant="secondary" onClick={onClick} disabled={download.isPending}>
        {download.isPending ? "Preparing…" : "Download"}
      </Button>
      {message && (
        <span className="form__error" role="alert">
          {" "}
          {message}
        </span>
      )}
    </p>
  );
}

function ResourceCard({ resource }: { resource: ResourceListItem }) {
  return (
    <li className="card">
      <p className="card__eyebrow">
        {categoryLabel(resource.category)}
        {resource.access_type === "restricted" && (
          <span className="badge badge--muted"> Restricted</span>
        )}
      </p>
      <h2 className="card__title">{resource.title}</h2>
      {resource.description && <p className="card__body">{resource.description}</p>}
      {resource.has_file && <DownloadButton resource={resource} />}
      {resource.external_url && (
        <p>
          <a href={resource.external_url} target="_blank" rel="noopener noreferrer">
            Open resource
          </a>
        </p>
      )}
    </li>
  );
}

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
                <ResourceCard key={r.id} resource={r} />
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
