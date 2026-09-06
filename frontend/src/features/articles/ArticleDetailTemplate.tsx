/**
 * Reusable article page for `PublishableContent`-backed types
 * (docs/UI_DESIGN_SYSTEM.md "ArticleDetailTemplate"). The owning feature
 * supplies the query, the `basePath`, and the feed label.
 */
import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ApiRequestError } from "../../api/request";
import { Breadcrumbs } from "../../components/Breadcrumbs/Breadcrumbs";
import { Container } from "../../components/Container/Container";
import { PageState } from "../../components/PageState/PageState";
import { RichText } from "../../components/RichText/RichText";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { NotFoundPage } from "../../pages/NotFoundPage";
import type { ArticleDetail } from "./types";

export interface ArticleDetailTemplateProps {
  query: UseQueryResult<ArticleDetail>;
  basePath: string;
  feedLabel: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function ArticleBody({ article, basePath, feedLabel }: { article: ArticleDetail } & Omit<ArticleDetailTemplateProps, "query">) {
  const byline = [formatDate(article.publish_date), article.author_name].filter(Boolean).join(" · ");
  return (
    <>
      <SEOHead
        title={article.seo_title || article.title}
        description={article.seo_description || article.summary || undefined}
        canonicalPath={`${basePath}/${article.slug}`}
      />
      <Container as="header" className="page-header">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: feedLabel, to: basePath },
            { label: article.title },
          ]}
        />
      </Container>

      <Section containerSize="narrow" ariaLabel={article.title}>
        <article className="article">
          <h1>{article.title}</h1>
          {byline && <p className="article__byline">{byline}</p>}
          {article.summary && <p className="article__summary">{article.summary}</p>}
          {article.content && <RichText html={article.content} />}
          {article.tags.length > 0 && (
            <ul className="service-tech article__tags">
              {article.tags.map((t) => (
                <li key={t.id} className="badge">
                  {t.name}
                </li>
              ))}
            </ul>
          )}
          <p className="article__back">
            <Link to={basePath}>← Back to {feedLabel}</Link>
          </p>
        </article>
      </Section>
    </>
  );
}

export function ArticleDetailTemplate({ query, basePath, feedLabel }: ArticleDetailTemplateProps) {
  if (query.isError && query.error instanceof ApiRequestError && query.error.status === 404) {
    return <NotFoundPage />;
  }
  return (
    <PageState
      query={query}
      loadingState={
        <Container>
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading article…</span>
            <Skeleton lines={8} />
          </div>
        </Container>
      }
    >
      {(article) => <ArticleBody article={article} basePath={basePath} feedLabel={feedLabel} />}
    </PageState>
  );
}
