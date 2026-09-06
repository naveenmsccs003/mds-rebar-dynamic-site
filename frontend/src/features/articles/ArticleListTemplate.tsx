/**
 * Reusable feed list for `PublishableContent`-backed types (News now;
 * Blogs / Events / CSR later). The owning feature supplies the query,
 * the URL `basePath` for item links, and the page copy.
 */
import type { UseQueryResult } from "@tanstack/react-query";

import { PAGE_SIZE } from "../../api/request";
import type { Paginated } from "../../api/envelope";
import { Card } from "../../components/Card/Card";
import { Container } from "../../components/Container/Container";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { PageState } from "../../components/PageState/PageState";
import { Pagination } from "../../components/Pagination/Pagination";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import type { Article } from "./types";

export interface ArticleListTemplateProps {
  query: UseQueryResult<Paginated<Article>>;
  basePath: string;
  title: string;
  description: string;
  canonicalPath: string;
  page: number;
  onPageChange: (page: number) => void;
  filters?: Filter[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function ArticleListTemplate({
  query,
  basePath,
  title,
  description,
  canonicalPath,
  page,
  onPageChange,
  filters,
}: ArticleListTemplateProps) {
  return (
    <>
      <SEOHead title={title} description={description} canonicalPath={canonicalPath} />
      <Container as="header" className="page-header">
        <h1 className="page-header__title">{title}</h1>
      </Container>

      {filters && filters.length > 0 && (
        <Container>
          <FilterBar filters={filters} />
        </Container>
      )}

      <PageState
        query={query}
        isEmpty={(p) => p.results.length === 0}
        loadingState={
          <Container>
            <div role="status" aria-live="polite">
              <span className="sr-only">Loading…</span>
              <Skeleton lines={6} />
            </div>
          </Container>
        }
        emptyState={
          <Container>
            <EmptyState title={`No ${title.toLowerCase()} published yet`} />
          </Container>
        }
      >
        {(pageData) => (
          <Section>
            <ul className="cms-card-grid">
              {pageData.results.map((a) => (
                <li key={a.id}>
                  <Card
                    title={a.title}
                    to={`${basePath}/${a.slug}`}
                    eyebrow={[a.category, formatDate(a.publish_date)].filter(Boolean).join(" · ")}
                  >
                    {a.summary && <p className="card__body">{a.summary}</p>}
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageCount={Math.ceil(pageData.count / PAGE_SIZE)}
              onChange={onPageChange}
            />
          </Section>
        )}
      </PageState>
    </>
  );
}
