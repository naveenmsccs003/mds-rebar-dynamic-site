/**
 * The four legal documents surfaced at `/legal/*` (spec §7). Each maps to
 * the CMS page `legal-<slug>`. Kept in its own module so `LegalPage`
 * stays a component-only file.
 */
export interface LegalDoc {
  slug: string;
  title: string;
  description: string;
}

export const LEGAL_DOCS = {
  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description: "How MDS Rebar collects, uses and protects personal data.",
  },
  terms: {
    slug: "terms",
    title: "Terms & Conditions",
    description: "The terms governing use of the MDS Rebar website and services.",
  },
  nda: {
    slug: "nda",
    title: "NDA / Confidentiality",
    description: "MDS Rebar's confidentiality and non-disclosure commitments.",
  },
  "data-security": {
    slug: "data-security",
    title: "Data Security & Compliance",
    description: "MDS Rebar's data security controls and compliance posture.",
  },
} as const satisfies Record<string, LegalDoc>;

export type LegalSlug = keyof typeof LEGAL_DOCS;
