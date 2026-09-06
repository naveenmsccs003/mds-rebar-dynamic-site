import { createBrowserRouter } from "react-router-dom";

import { AboutPage } from "../features/about/AboutPage";
import { HomePage } from "../features/home/HomePage";
import { LegalPage } from "../features/legal/LegalPage";
import { PublicLayout } from "../layouts/PublicLayout";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";

/**
 * Route table matching the public navigation in the spec (§7). Phase 5
 * fills in the CMS-driven pages (home, about, legal/*, 404); the
 * remaining routes stay `PlaceholderPage` until their owning phase
 * (services → 6, portfolio/news/blogs/events → 7, careers → 8,
 * contact/quote → 9, search → 11, admin/logins → 3/12 frontend work).
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
      { path: "services", element: <PlaceholderPage title="Services" /> },
      { path: "services/:slug", element: <PlaceholderPage title="Service Detail" /> },
      { path: "portfolio", element: <PlaceholderPage title="Portfolio" /> },
      { path: "portfolio/:slug", element: <PlaceholderPage title="Project Detail" /> },
      { path: "resources", element: <PlaceholderPage title="Resources" /> },
      { path: "news", element: <PlaceholderPage title="News" /> },
      { path: "news/:slug", element: <PlaceholderPage title="News Article" /> },
      { path: "blogs", element: <PlaceholderPage title="Blogs" /> },
      { path: "blogs/:slug", element: <PlaceholderPage title="Blog Post" /> },
      { path: "events", element: <PlaceholderPage title="Events" /> },
      { path: "events/:slug", element: <PlaceholderPage title="Event Detail" /> },
      { path: "csr", element: <PlaceholderPage title="CSR" /> },
      { path: "careers", element: <PlaceholderPage title="Careers" /> },
      { path: "careers/:slug", element: <PlaceholderPage title="Job Detail" /> },
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
