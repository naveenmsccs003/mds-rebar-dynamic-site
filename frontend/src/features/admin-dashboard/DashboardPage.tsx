/**
 * Admin landing — a few "needs attention" counts, each shown only if the
 * user can see that queue. The numbers come from the list endpoints'
 * `count`, so this stays honest as those lists get their own screens.
 */
import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useSession } from "../auth/hooks";
import { usePermissionChecker } from "../auth/usePermission";
import { countOf } from "./api";

interface Tile {
  label: string;
  to: string;
  perms: string[];
  path: string;
  params: Record<string, string>;
}

const TILES: Tile[] = [
  {
    label: "CMS sections in review",
    to: "/admin/cms/sections",
    perms: ["pages.view_pagesection"],
    path: "/admin/cms/sections/",
    params: { status: "review" },
  },
  {
    label: "New quote requests",
    to: "/admin/quote-requests",
    perms: ["quotations.view_quoterequest"],
    path: "/admin/quote-requests/",
    params: { status: "new" },
  },
  {
    label: "New enquiries",
    to: "/admin/enquiries",
    perms: ["contact.view_enquiry"],
    path: "/admin/enquiries/",
    params: { status: "new" },
  },
  {
    label: "New applications",
    to: "/admin/applications",
    perms: ["applications.view_jobapplication"],
    path: "/admin/career-applications/",
    params: { status: "new" },
  },
];

export function DashboardPage() {
  const { data: session } = useSession();
  const can = usePermissionChecker();
  const visible = TILES.filter((t) => can(t.perms));

  const results = useQueries({
    queries: visible.map((t) => ({
      queryKey: ["admin", "dashboard", t.path, t.params],
      queryFn: () => countOf(t.path, t.params),
      staleTime: 60_000,
    })),
  });

  return (
    <>
      <SEOHead title="Dashboard" noindex />
      <h1>Welcome, {session?.first_name || session?.email}</h1>
      <p className="admin-muted">
        Roles: {session?.roles.length ? session.roles.join(", ") : "none"}
      </p>

      {visible.length === 0 ? (
        <p className="admin-muted">Your role has no work queues on this dashboard.</p>
      ) : (
        <ul className="admin-tiles">
          {visible.map((t, i) => {
            const q = results[i];
            return (
              <li key={t.to} className="admin-tile">
                <Link to={t.to}>
                  <span className="admin-tile__value">
                    {q.isPending ? <Skeleton lines={1} /> : q.isError ? "—" : q.data}
                  </span>
                  <span className="admin-tile__label">{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
