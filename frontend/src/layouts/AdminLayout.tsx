/**
 * Chrome for every `/admin` route — its own header + sidebar, no public
 * site nav. The sidebar shows only the sections the signed-in user's
 * permissions allow (docs/RBAC_DESIGN.md); the server still enforces
 * every request.
 */
import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useLogout, useSession } from "../features/auth/hooks";
import { usePermissionChecker } from "../features/auth/usePermission";
import { ADMIN_NAV } from "./adminNav";

export function AdminLayout() {
  const { data: session } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const can = usePermissionChecker();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const lastPath = useRef(location.pathname);

  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    mainRef.current?.focus();
  }, [location.pathname]);

  const groups = ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.perms || can(i.perms)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="admin-layout">
      <a className="skip-link" href="#admin-main">
        Skip to main content
      </a>

      <header className="admin-layout__header">
        <span className="admin-layout__brand">MDS Rebar admin</span>
        <div className="admin-layout__user">
          <span>{session?.full_name || session?.email}</span>
          <NavLink to="/admin/password" className="admin-layout__link">
            Password
          </NavLink>
          <button
            type="button"
            className="button button--secondary"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/admin/login") })}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="admin-layout__body">
        <nav className="admin-layout__sidebar" aria-label="Admin sections">
          {groups.map((group) => (
            <div key={group.heading} className="admin-nav__group">
              <p className="admin-nav__heading">{group.heading}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/admin"}
                      className={({ isActive }) =>
                        isActive ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main id="admin-main" ref={mainRef} tabIndex={-1} className="admin-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
