import { createBrowserRouter } from "react-router-dom";

import { HomePage } from "../features/home/HomePage";
import { LegalPage } from "../features/legal/LegalPage";
import { PublicLayout } from "../layouts/PublicLayout";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";

import { lazyRoute as route } from "./lazyRoute";

/**
 * Route table matching the public navigation in the spec (§7).
 *
 * Every non-home route is code-split (`React.lazy`) so the initial
 * bundle is just the shell + homepage (docs/PERFORMANCE.md "Frontend":
 * "Code splitting per route"). Vite emits one chunk per `import()`; the
 * `<Suspense>` fallback below covers the fetch.
 *
 * Services/Portfolio/News/Blogs/Events detail routes use a single
 * `:slug` param feeding one reusable template component each (spec §10 —
 * never one React page per service/article).
 */
const placeholder = (title: string) => ({ element: <PlaceholderPage title={title} /> });

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: route(() => import("../features/about/AboutPage"), (m) => m.AboutPage) },
      { path: "services", element: route(() => import("../features/services/ServiceListPage"), (m) => m.ServiceListPage) },
      { path: "services/:slug", element: route(() => import("../features/services/ServiceDetailTemplate"), (m) => m.ServiceDetailTemplate) },
      { path: "portfolio", element: route(() => import("../features/portfolio/PortfolioListTemplate"), (m) => m.PortfolioListTemplate) },
      { path: "portfolio/:slug", element: route(() => import("../features/portfolio/PortfolioDetailTemplate"), (m) => m.PortfolioDetailTemplate) },
      { path: "resources", element: route(() => import("../features/resources/ResourceListTemplate"), (m) => m.ResourceListTemplate) },
      { path: "news", element: route(() => import("../features/news/NewsListPage"), (m) => m.NewsListPage) },
      { path: "news/:slug", element: route(() => import("../features/news/NewsArticlePage"), (m) => m.NewsArticlePage) },
      { path: "blogs", ...placeholder("Blogs") },
      { path: "blogs/:slug", ...placeholder("Blog Post") },
      { path: "events", ...placeholder("Events") },
      { path: "events/:slug", ...placeholder("Event Detail") },
      { path: "csr", ...placeholder("CSR") },
      { path: "careers", element: route(() => import("../features/careers/CareersListPage"), (m) => m.CareersListPage) },
      { path: "careers/:slug", element: route(() => import("../features/careers/JobDetailTemplate"), (m) => m.JobDetailTemplate) },
      { path: "contact", element: route(() => import("../features/contact/ContactPage"), (m) => m.ContactPage) },
      { path: "request-quote", element: route(() => import("../features/quote/RequestQuotePage"), (m) => m.RequestQuotePage) },
      { path: "search", element: route(() => import("../features/search/SearchPage"), (m) => m.SearchPage) },
      { path: "login/staff", ...placeholder("Staff Login") },
      { path: "login/knowledge-base", ...placeholder("Knowledge Base Login") },
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
