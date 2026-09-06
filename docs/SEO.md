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

## Sitemap & robots
`/sitemap.xml` generated from published content (services, portfolio,
blogs, news, events, careers), regenerated on publish/unpublish via a
Celery task or Django's sitemap framework. `/robots.txt` disallows admin
and private-file paths, allows everything public.

## Rendering
Public pages need real meta tags in the document `<head>` at response
time for crawlers/social previews — evaluated in Phase 5 whether this
requires SSR/prerendering for the marketing pages (recommended) versus
client-only rendering, since a pure client-rendered SPA cannot reliably
serve per-page OG tags to crawlers/social scrapers.
