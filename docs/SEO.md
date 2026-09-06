# SEO

## CMS-driven metadata
Every public content model carries: SEO title, meta description,
canonical URL, keywords (where relevant), OG title/description/image, and
Twitter/X card fields — all admin-editable, never hardcoded per page in
React.

## URLs
Clean, human-readable slugs (`/services/rebar-detailing`,
`/portfolio/<slug>`, `/blog/<slug>`) — never ID-based query strings for
public content. Slug changes create a `Redirect` record (old path → new
path, 301) so links and search rankings aren't broken.

## Structured data
JSON-LD injected per page type (Organization on the homepage, Article on
blog/news posts, JobPosting on career listings, BreadcrumbList site-wide)
using data already present on the content model — not fabricated fields.

**Implemented (Phase 11):** frontend `components/JsonLd` — `<JsonLd>`
renders a single `application/ld+json` block (angle brackets escaped);
builders in `JsonLd/schemas.ts`. `organizationLd` on the homepage,
`articleLd` on every `ArticleDetailTemplate` (news now), `jobPostingLd`
on every job detail page. BreadcrumbList is a follow-up.

## Sitemap & robots
`/sitemap.xml` generated from published content (services, portfolio,
blogs, news, events, careers), regenerated on publish/unpublish via a
Celery task or Django's sitemap framework. `/robots.txt` disallows admin
and private-file paths, allows everything public.

**Implemented (Phase 11):** Django's `django.contrib.sitemaps`
(`apps.pages.sitemaps` — per-type `Sitemap` classes, published items
only, `RequestSite` so URLs use the request host, `protocol="https"`)
served at `/sitemap.xml`; `config.seo.robots_txt` at `/robots.txt`
disallows `/admin/`, `/api/v1/admin/`, `/api/v1/files/`,
`/api/v1/documents/`, `/api/schema/`, `/api/docs/` and points at the
sitemap. Blogs/events/csr sitemaps join when those models ship.

## Rendering
Public pages need real meta tags in the document `<head>` at response
time for crawlers/social previews — evaluated in Phase 5 whether this
requires SSR/prerendering for the marketing pages (recommended) versus
client-only rendering, since a pure client-rendered SPA cannot reliably
serve per-page OG tags to crawlers/social scrapers.

### Decision (Phase 5)
The public site is a client-rendered Vite/React SPA. Per-page metadata is
owned by the `SEOHead` component (`title` / description / canonical /
OG / Twitter), which relies on **React 19's built-in `<title>` / `<meta>`
/ `<link>` hoisting** — no `react-helmet`. Exactly one page renders per
route, so there is one `SEOHead` mounted at a time; navigation unmounts
the previous page and removes its tags.

This is correct for JS-capable clients and modern crawlers (Googlebot
executes JS), but a raw fetch of `index.html` still returns the shell's
generic `<head>`. So **build-time prerendering of the marketing routes**
(`/`, `/about`, `/services`, `/services/*`, `/portfolio*`, `/news*`,
`/blogs*`, `/events*`, `/csr`, `/careers*`, `/legal/*`) is planned for
the deploy pipeline (Phase 15) — a prerender step (`vite-plugin-prerender`
/ `react-snap` / a hosted prerender service keyed off the sitemap) that
writes static HTML with the resolved `<head>` per route, with the SPA
hydrating on top. Admin routes are never prerendered or indexed.
