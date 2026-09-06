import { createBrowserRouter } from "react-router-dom";

import { PublicLayout } from "../layouts/PublicLayout";
import { PlaceholderPage } from "../pages/PlaceholderPage";

/**
 * Route table matching the public navigation in the spec (§7). Every
 * entry is a PlaceholderPage until its owning phase (5-11) replaces it
 * with the real feature module — the route path/shape is decided now so
 * later phases build content, not routing.
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
      { index: true, element: <PlaceholderPage title="Home" /> },
      { path: "about", element: <PlaceholderPage title="About" /> },
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
      { path: "legal/privacy-policy", element: <PlaceholderPage title="Privacy Policy" /> },
      { path: "legal/terms", element: <PlaceholderPage title="Terms & Conditions" /> },
      { path: "legal/nda", element: <PlaceholderPage title="NDA / Confidentiality" /> },
      { path: "legal/data-security", element: <PlaceholderPage title="Data Security & Compliance" /> },
      { path: "*", element: <PlaceholderPage title="Page Not Found" /> },
    ],
  },
  {
    path: "/admin",
    element: <PlaceholderPage title="Admin Panel" />,
  },
]);
