import { CmsPage } from "../cms/CmsPage";

export function AboutPage() {
  return (
    <CmsPage
      pageKey="about"
      seoTitle="About"
      seoDescription="Who MDS Rebar is: our positioning, capabilities and approach to rebar detailing and construction engineering."
      canonicalPath="/about"
      heading="About MDS Rebar"
      breadcrumbs={[{ label: "Home", to: "/" }, { label: "About" }]}
    />
  );
}
