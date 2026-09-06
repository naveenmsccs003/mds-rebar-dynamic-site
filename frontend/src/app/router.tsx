import { createBrowserRouter } from "react-router-dom";

import { AboutPage } from "../features/about/AboutPage";
import { CareersListPage } from "../features/careers/CareersListPage";
import { JobDetailTemplate } from "../features/careers/JobDetailTemplate";
import { HomePage } from "../features/home/HomePage";
import { LegalPage } from "../features/legal/LegalPage";
import { NewsArticlePage } from "../features/news/NewsArticlePage";
import { NewsListPage } from "../features/news/NewsListPage";
import { PortfolioDetailTemplate } from "../features/portfolio/PortfolioDetailTemplate";
import { PortfolioListTemplate } from "../features/portfolio/PortfolioListTemplate";
import { ResourceListTemplate } from "../features/resources/ResourceListTemplate";
import { ServiceDetailTemplate } from "../features/services/ServiceDetailTemplate";
import { ServiceListPage } from "../features/services/ServiceListPage";
import { PublicLayout } from "../layouts/PublicLayout";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";

/**
 * Route table matching the public navigation in the spec (§7). Filled in
 * by phase: home/about/legal/404 (Phase 5), services (Phase 6),
 * portfolio/resources/news (Phase 7), careers (Phase 8). The remaining
 * routes stay `PlaceholderPage` until their owning phase
 * (blogs/events/csr → 7-later, contact/quote → 9, search → 11,
 * admin/logins → later).
 *
 * Services/Portfolio/News/Blogs/Events detail routes use a single
 * `:slug` param feeding one reusable template component each (spec §10 —
 * never one React page per service/article), not a route per item.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <AboutPage /> },
      { path: "services", element: <ServiceListPage /> },
      { path: "services/:slug", element: <ServiceDetailTemplate /> },
      { path: "portfolio", element: <PortfolioListTemplate /> },
      { path: "portfolio/:slug", element: <PortfolioDetailTemplate /> },
      { path: "resources", element: <ResourceListTemplate /> },
      { path: "news", element: <NewsListPage /> },
      { path: "news/:slug", element: <NewsArticlePage /> },
      { path: "blogs", element: <PlaceholderPage title="Blogs" /> },
      { path: "blogs/:slug", element: <PlaceholderPage title="Blog Post" /> },
      { path: "events", element: <PlaceholderPage title="Events" /> },
      { path: "events/:slug", element: <PlaceholderPage title="Event Detail" /> },
      { path: "csr", element: <PlaceholderPage title="CSR" /> },
      { path: "careers", element: <CareersListPage /> },
      { path: "careers/:slug", element: <JobDetailTemplate /> },
      { path: "contact", element: <PlaceholderPage title="Contact" /> },
      { path: "request-quote", element: <PlaceholderPage title="Request Quote" /> },
      { path: "search", element: <PlaceholderPage title="Search" /> },
      { path: "login/staff", element: <PlaceholderPage title="Staff Login" /> },
      { path: "login/knowledge-base", element: <PlaceholderPage title="Knowledge Base Login" /> },
      { path: "legal/privacy-policy", element: <LegalPage slug="privacy-policy" /> },
      { path: "legal/terms", element: <LegalPage slug="terms" /> },
      { path: "legal/nda", element: <LegalPage slug="nda" /> },
      { path: "legal/data-security", element: <LegalPage slug="data-security" /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "/admin",
    element: <PlaceholderPage title="Admin Panel" />,
  },
]);
