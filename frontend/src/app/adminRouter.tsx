import type { RouteObject } from "react-router-dom";

import { RequireAuth } from "../features/auth/guards";
import { AdminLayout } from "../layouts/AdminLayout";
import { lazyRoute } from "./lazyRoute";

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
