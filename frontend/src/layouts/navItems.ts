/**
 * Public navigation (spec §7). Static for now — a CMS-managed navigation
 * model isn't in scope for Phase 5; when it lands, only this file and the
 * fetch behind it change, not `PublicLayout`.
 */
export interface NavItem {
  label: string;
  to: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "About", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "Portfolio", to: "/portfolio" },
  { label: "Resources", to: "/resources" },
  { label: "News", to: "/news" },
  { label: "Careers", to: "/careers" },
  { label: "Contact", to: "/contact" },
];

export const FOOTER_NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Company",
    items: [
      { label: "About", to: "/about" },
      { label: "Careers", to: "/careers" },
      { label: "CSR", to: "/csr" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    heading: "Work",
    items: [
      { label: "Services", to: "/services" },
      { label: "Portfolio", to: "/portfolio" },
      { label: "Resources", to: "/resources" },
    ],
  },
  {
    heading: "Insights",
    items: [
      { label: "News", to: "/news" },
      { label: "Blogs", to: "/blogs" },
      { label: "Events", to: "/events" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Privacy Policy", to: "/legal/privacy-policy" },
      { label: "Terms & Conditions", to: "/legal/terms" },
      { label: "NDA / Confidentiality", to: "/legal/nda" },
      { label: "Data Security & Compliance", to: "/legal/data-security" },
    ],
  },
];
