/**
 * Public homepage. Every band is a CMS section (docs/UI_DESIGN_SYSTEM.md
 * homepage section order) — this component only fetches `page_key=home`
 * and hands the sections to `CmsPage`; editors control order, copy and
 * visibility from the admin without a frontend deploy.
 */
import { JsonLd } from "../../components/JsonLd/JsonLd";
import { organizationLd } from "../../components/JsonLd/schemas";
import { CmsPage } from "../cms/CmsPage";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

export function HomePage() {
  return (
    <>
      <JsonLd data={organizationLd(`${ORIGIN}/`)} />
      <CmsPage
        pageKey="home"
        seoTitle="MDS Rebar"
        seoDescription="MDS Rebar — accuracy, experience, sustainability and integrity in rebar detailing and construction engineering services worldwide."
        canonicalPath="/"
      />
    </>
  );
}
