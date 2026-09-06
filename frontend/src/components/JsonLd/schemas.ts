/**
 * schema.org builders for `JsonLd` (docs/SEO.md "Structured data").
 * Every field comes from data already on the content model — nothing is
 * fabricated. Split from the component file so Fast Refresh stays happy.
 */
const PUBLISHER = { "@type": "Organization", name: "MDS Rebar" } as const;

export function organizationLd(url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MDS Rebar",
    description:
      "Rebar detailing and construction engineering services — accuracy, experience, sustainability, integrity.",
    url,
  };
}

export function jobPostingLd(job: {
  title: string;
  description: string;
  datePosted: string;
  validThrough: string | null;
  employmentType: string;
  location: string;
}) {
  const employmentMap: Record<string, string> = {
    full_time: "FULL_TIME",
    part_time: "PART_TIME",
    contract: "CONTRACTOR",
    internship: "INTERN",
  };
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.datePosted,
    ...(job.validThrough ? { validThrough: job.validThrough } : {}),
    employmentType: employmentMap[job.employmentType] ?? job.employmentType,
    hiringOrganization: PUBLISHER,
    ...(job.location
      ? {
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: job.location },
          },
        }
      : {}),
  };
}

export function articleLd(article: {
  headline: string;
  description: string;
  datePublished: string | null;
  dateModified: string | null;
  author: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.headline,
    ...(article.description ? { description: article.description } : {}),
    ...(article.datePublished ? { datePublished: article.datePublished } : {}),
    ...(article.dateModified ? { dateModified: article.dateModified } : {}),
    ...(article.author ? { author: { "@type": "Person", name: article.author } } : {}),
    publisher: PUBLISHER,
    mainEntityOfPage: article.url,
  };
}
