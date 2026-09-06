/**
 * Shared shell for any public page whose body is CMS-managed sections
 * (home, about, legal, …). Handles the four data states, injects
 * per-page `<SEOHead>`, and renders an optional visible page header
 * (breadcrumbs + `<h1>`) for interior pages whose sections don't include
 * a hero.
 */
import type { ReactNode } from "react";

import { Breadcrumbs, type Crumb } from "../../components/Breadcrumbs/Breadcrumbs";
import { Container } from "../../components/Container/Container";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { PageState } from "../../components/PageState/PageState";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { SectionRenderer } from "./sections/SectionRenderer";
import { usePage } from "./usePage";

export interface CmsPageProps {
  pageKey: string;
  seoTitle: string;
  seoDescription?: string;
  canonicalPath: string;
  /** Rendered above the sections as a visible `<h1>` (interior pages). */
  heading?: string;
  breadcrumbs?: Crumb[];
  /** Shown when the page has no published sections yet. */
  emptyHint?: ReactNode;
}

export function CmsPage({
  pageKey,
  seoTitle,
  seoDescription,
  canonicalPath,
  heading,
  breadcrumbs,
  emptyHint,
}: CmsPageProps) {
  const query = usePage(pageKey);

  return (
    <>
      <SEOHead title={seoTitle} description={seoDescription} canonicalPath={canonicalPath} />

      {(breadcrumbs || heading) && (
        <Container as="header" className="page-header">
          {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
          {heading && <h1 className="page-header__title">{heading}</h1>}
        </Container>
      )}

      <PageState
        query={query}
        isEmpty={(sections) => sections.length === 0}
        loadingState={
          <Container>
            <div role="status" aria-live="polite">
              <span className="sr-only">Loading page content…</span>
              <Skeleton lines={6} />
            </div>
          </Container>
        }
        emptyState={
          <Container>
            <EmptyState
              title="This page hasn't been published yet"
              description={
                typeof emptyHint === "string"
                  ? emptyHint
                  : "[CONTENT PLACEHOLDER — ADMIN TO COMPLETE]"
              }
            />
          </Container>
        }
      >
        {(sections) => <SectionRenderer sections={sections} />}
      </PageState>
    </>
  );
}
