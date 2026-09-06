/**
 * The four legal routes (privacy policy, terms, NDA, data security) share
 * one component — each renders the CMS page `legal-<slug>` through the
 * same shell (spec §10 — no page-per-document duplication).
 */
import { CmsPage } from "../cms/CmsPage";
import { LEGAL_DOCS, type LegalSlug } from "./legalDocs";

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const doc = LEGAL_DOCS[slug];
  return (
    <CmsPage
      pageKey={`legal-${doc.slug}`}
      seoTitle={doc.title}
      seoDescription={doc.description}
      canonicalPath={`/legal/${doc.slug}`}
      heading={doc.title}
      breadcrumbs={[{ label: "Home", to: "/" }, { label: doc.title }]}
    />
  );
}
