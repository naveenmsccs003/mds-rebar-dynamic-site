import type { ReactElement } from "react";
import type { RouteObject } from "react-router-dom";

import { RequireAuth, RequirePermission } from "../features/auth/guards";
import { AdminLayout } from "../layouts/AdminLayout";
import { lazyRoute } from "./lazyRoute";

/** A `/admin` route element behind a permission gate. */
function gated(perms: string | string[], element: ReactElement): ReactElement {
  return <RequirePermission perms={perms}>{element}</RequirePermission>;
}

/**
 * The `/admin` route subtree (docs/RBAC_DESIGN.md). `login` is public;
 * everything else is behind `<RequireAuth>` + `<AdminLayout>`. Screens
 * are added per admin sub-phase (A2 CMS, A3 catalogue, …); each new
 * route element is wrapped in `<RequirePermission>` for its section.
 */
export const adminRoute: RouteObject = {
  path: "/admin",
  children: [
    {
      path: "login",
      element: lazyRoute(() => import("../features/auth/LoginPage"), (m) => m.LoginPage),
    },
    {
      element: (
        <RequireAuth>
          <AdminLayout />
        </RequireAuth>
      ),
      children: [
        {
          index: true,
          element: lazyRoute(
            () => import("../features/admin-dashboard/DashboardPage"),
            (m) => m.DashboardPage,
          ),
        },
        {
          path: "password",
          element: lazyRoute(
            () => import("../features/auth/PasswordChangePage"),
            (m) => m.PasswordChangePage,
          ),
        },

        // --- CMS (A2) ---
        {
          path: "cms/sections",
          element: gated(
            "pages.view_pagesection",
            lazyRoute(() => import("../features/admin-cms/SectionsPage"), (m) => m.SectionsPage),
          ),
        },
        {
          path: "cms/settings",
          element: gated(
            "pages.view_sitesetting",
            lazyRoute(() => import("../features/admin-cms/SettingsPage"), (m) => m.SettingsPage),
          ),
        },
        {
          path: "cms/tags",
          element: gated(
            "pages.view_tag",
            lazyRoute(() => import("../features/admin-cms/TagsPage"), (m) => m.TagsPage),
          ),
        },
        {
          path: "cms/redirects",
          element: gated(
            "pages.view_redirect",
            lazyRoute(() => import("../features/admin-cms/RedirectsPage"), (m) => m.RedirectsPage),
          ),
        },

        // --- catalogue (A3) ---
        {
          path: "services",
          element: gated(
            "services.view_service",
            lazyRoute(() => import("../features/admin-catalogue/ServicesPage"), (m) => m.ServicesPage),
          ),
        },
        {
          path: "portfolio",
          element: gated(
            "portfolio.view_project",
            lazyRoute(() => import("../features/admin-catalogue/PortfolioPage"), (m) => m.PortfolioPage),
          ),
        },
        {
          path: "news",
          element: gated(
            "news.view_news",
            lazyRoute(() => import("../features/admin-catalogue/NewsPage"), (m) => m.NewsPage),
          ),
        },
        {
          path: "resources",
          element: gated(
            "resources.view_resource",
            lazyRoute(() => import("../features/admin-catalogue/ResourcesPage"), (m) => m.ResourcesPage),
          ),
        },
        {
          path: "careers",
          element: gated(
            "careers.view_jobposting",
            lazyRoute(() => import("../features/admin-catalogue/CareersPage"), (m) => m.CareersPage),
          ),
        },

        {
          path: "*",
          element: lazyRoute(
            () => import("../pages/AdminNotFoundPage"),
            (m) => m.AdminNotFoundPage,
          ),
        },
      ],
    },
  ],
};
