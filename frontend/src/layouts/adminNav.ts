/**
 * Admin sidebar (docs/RBAC_DESIGN.md). Each item declares the permission
 * codename(s) that make it visible — the same codenames the backend
 * viewsets require, so a role sees exactly the sections it can use. A
 * missing `perms` means "any signed-in staff user".
 *
 * Sections are filled in per admin sub-phase (A2 CMS, A3 catalogue, …);
 * an unbuilt route points at a placeholder until then.
 */
export interface AdminNavItem {
  label: string;
  to: string;
  perms?: string[];
}

export interface AdminNavGroup {
  heading: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", to: "/admin" }],
  },
  {
    heading: "Content",
    items: [
      { label: "CMS sections", to: "/admin/cms/sections", perms: ["pages.view_pagesection"] },
      { label: "Site settings", to: "/admin/cms/settings", perms: ["pages.view_sitesetting"] },
      { label: "Tags", to: "/admin/cms/tags", perms: ["pages.view_tag"] },
      { label: "Redirects", to: "/admin/cms/redirects", perms: ["pages.view_redirect"] },
      { label: "Services", to: "/admin/services", perms: ["services.view_service"] },
      { label: "Portfolio", to: "/admin/portfolio", perms: ["portfolio.view_project"] },
      { label: "News", to: "/admin/news", perms: ["news.view_news"] },
      { label: "Resources", to: "/admin/resources", perms: ["resources.view_resource"] },
      { label: "Careers", to: "/admin/careers", perms: ["careers.view_jobposting"] },
    ],
  },
  {
    heading: "Inbox",
    items: [
      { label: "Quote requests", to: "/admin/quote-requests", perms: ["quotations.view_quoterequest"] },
      { label: "Enquiries", to: "/admin/enquiries", perms: ["contact.view_enquiry"] },
      { label: "Applications", to: "/admin/applications", perms: ["applications.view_jobapplication"] },
    ],
  },
  {
    heading: "Library",
    items: [{ label: "Media", to: "/admin/media", perms: ["media.view_mediaasset"] }],
  },
  {
    heading: "Administration",
    items: [
      { label: "Users", to: "/admin/users", perms: ["users.view_user"] },
      { label: "Roles", to: "/admin/roles", perms: ["auth.view_group"] },
      { label: "Audit log", to: "/admin/audit", perms: ["audit.view_auditlog"] },
    ],
  },
];
