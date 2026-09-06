/**
 * Public homepage. Every band is a CMS section (docs/UI_DESIGN_SYSTEM.md
 * homepage section order) — this component only fetches `page_key=home`
 * and hands the sections to `CmsPage`; editors control order, copy and
 * visibility from the admin without a frontend deploy.
 */
import { CmsPage } from "../cms/CmsPage";

export function HomePage() {
  return (
    <CmsPage
      pageKey="home"
      seoTitle="MDS Rebar"
      seoDescription="MDS Rebar — accuracy, experience, sustainability and integrity in rebar detailing and construction engineering services worldwide."
      canonicalPath="/"
    />
  );
}
