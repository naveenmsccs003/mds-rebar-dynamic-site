# UI Design System

## Positioning
Premium global engineering/construction technology company: clean,
professional, corporate, modern, spacious, trustworthy. Not a startup
SaaS aesthetic — no cartoonish illustration, excessive gradients,
over-rounded cards, or fabricated stat callouts.

## Visual language
- **Surfaces:** predominantly white/light-neutral; deep navy/charcoal
  used for high-contrast sections (hero, CTA, footer, "Why MDS").
- **Accent:** a single professional blue for primary CTAs and links —
  used sparingly and consistently, not scattered across the palette.
- **Borders/shadows:** subtle, 1px hairline borders and low-elevation
  shadows; no heavy neumorphism or glow effects.
- **Typography:** a strong, legible sans-serif pairing — one weight-varied
  family for headings, one for body — generous line-height, clear type
  scale (e.g., 12/14/16/18/24/32/48/64px steps).
- **Imagery:** high-quality engineering/construction photography and
  technical drawings where available; otherwise clearly-labeled
  placeholders — never stock photos presented as real project work.
- **Motion:** minimal — short opacity/transform transitions on
  hover/focus and route change; no scroll-jacking, no decorative
  animation that delays content.

## Layout
- 12-column responsive grid, consistent spacing scale (4/8px base unit).
- Breakpoints: mobile (≤480), large mobile (≤767), tablet (≤1023),
  laptop (≤1439), desktop (≥1440). Mobile layouts are designed
  purpose-built (stacked nav, condensed hero, priority content first) —
  not a shrunk desktop grid.

## Component library (`src/components`)
Reusable, accessible, tested independent of any single feature:
Button, Input, Select, Textarea, Checkbox/Radio, FormField (label + error
+ hint), Modal/Dialog, ConfirmDialog, Table (sortable, paginated),
Pagination, FilterBar, Card, Breadcrumbs, Tabs, Alert/Toast,
LoadingState (skeleton), EmptyState, ErrorState (with retry), Badge,
Avatar, FileUpload (drag/drop with progress), RichTextRenderer
(sanitized), SEOHead (title/meta/OG/canonical injector).

Every component: keyboard operable, visible focus ring, correct ARIA
role/label, sufficient color contrast (WCAG 2.2 AA), and documented
loading/empty/error states where it renders remote data.

### Implemented so far (Phase 5)
`Button`, `LoadingState`, `EmptyState`, `ErrorState` (Phase 1) plus
`Container` (max-width + gutters), `Section` (full-bleed band with
`tone="default|muted|dark"`), `Card`, `Breadcrumbs`, `Skeleton`,
`SEOHead` (React 19 native `<title>`/`<meta>` hoisting — see
`docs/SEO.md`), `RichText` (client-side DOMPurify re-sanitisation of the
already-server-sanitised CMS HTML), and `PageState` (collapses a
TanStack Query result into the four required data states). Design tokens
(colour, 4/8px spacing scale, 12→64px type scale, container widths) live
in `src/index.css`. The homepage/about/legal pages render through
`features/cms/` — `SectionRenderer` maps `PageSection.section_key` to a
section component (`hero`, `prose`, `cta`, `card_grid`, `stat_list`, with
a safe fallback) in the API's `display_order`, so editors reorder/hide
sections from the CMS without a frontend deploy. Remaining components
(forms, Table, Modal, Tabs, FileUpload, admin `ListPageTemplate`, …)
land with the features that first need them (Phases 6–12).

## Page templates (reused, not duplicated per content item)
- `ServiceDetailTemplate` — renders any service from its DB record
  (breadcrumb → hero → overview → capabilities → process → business
  value → technology → standards → deliverables → output formats → FAQs
  → related services/portfolio → quote CTA).
- `PortfolioListTemplate` / `PortfolioDetailTemplate`
- `ResourceListTemplate`
- `ArticleListTemplate` / `ArticleDetailTemplate` (shared by News, Blogs,
  Events, CSR — same shape, different category/feed)
- `JobListTemplate` / `JobDetailTemplate`
- Admin: `ListPageTemplate` (search + filters + table + pagination + bulk
  actions + create/edit/view/delete actions + all four data states) reused
  across every CMS/admin module.

## Homepage section order (data-driven, never hardcoded)
Header → Hero → Value/Trust → Services → Markets → Industries → Why MDS →
Technology → Process → Portfolio Highlights → Testimonials → Trackmate →
CSR → Call To Action → Footer. Each section renders from an API response;
editors reorder/hide sections and edit copy from the CMS without a
frontend deploy.

## Accessibility targets
WCAG 2.2 AA across both the public site and the admin panel: semantic
HTML landmarks, logical heading order, full keyboard navigation,
managed focus on route change/modal open, descriptive alt text (editable
per image in the CMS), accessible form validation (associated errors,
not color-only), and screen-reader-tested tables/filters/galleries.
