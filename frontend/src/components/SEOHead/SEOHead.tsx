/**
 * Per-page document metadata (docs/SEO.md — title/meta/OG/canonical are
 * CMS-driven, never hardcoded per page in React).
 *
 * Uses React 19's built-in hoisting: `<title>` / `<meta>` / `<link>`
 * rendered anywhere in the tree are moved into `<head>`. Only one page
 * renders per route, so there is exactly one SEOHead mounted at a time;
 * on navigation the previous page unmounts and its tags are removed.
 *
 * A pure client-rendered SPA still cannot guarantee these tags reach
 * every crawler/social scraper — see docs/SEO.md "Rendering" for the
 * prerendering follow-up. This component is the render-time source of
 * truth either way.
 */
const SITE_NAME = "MDS Rebar";

export interface SEOHeadProps {
  title: string;
  description?: string;
  /** Path (with leading slash) this page should be canonical at. */
  canonicalPath?: string;
  ogImage?: string;
  noindex?: boolean;
}

function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location) return window.location.origin;
  return import.meta.env.VITE_SITE_ORIGIN ?? "";
}

export function SEOHead({ title, description, canonicalPath, ogImage, noindex }: SEOHeadProps) {
  const fullTitle = title === SITE_NAME ? title : `${title} — ${SITE_NAME}`;
  const canonical = canonicalPath ? `${siteOrigin()}${canonicalPath}` : undefined;

  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {canonical && <link rel="canonical" href={canonical} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {canonical && <meta property="og:url" content={canonical} />}
      {ogImage && <meta property="og:image" content={ogImage} />}

      <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}
    </>
  );
}
