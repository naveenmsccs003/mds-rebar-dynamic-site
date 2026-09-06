import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { articleLd, jobPostingLd, organizationLd } from "./schemas";
import { JsonLd } from "./JsonLd";

function parseLd(container: HTMLElement) {
  const el = container.querySelector('script[type="application/ld+json"]');
  return el ? JSON.parse(el.textContent ?? "{}") : null;
}

describe("JsonLd", () => {
  it("emits a valid application/ld+json script", () => {
    const { container } = render(<JsonLd data={{ "@type": "Thing", name: "x" }} />);
    expect(parseLd(container)).toEqual({ "@type": "Thing", name: "x" });
  });

  it("escapes angle brackets so no markup can break out", () => {
    const { container } = render(<JsonLd data={{ name: "</script><b>x</b>" }} />);
    const raw = container.querySelector("script")!.textContent!;
    expect(raw).not.toContain("</script>");
    expect(parseLd(container).name).toBe("</script><b>x</b>");
  });

  it("organizationLd carries the site url", () => {
    expect(organizationLd("https://mds.example/")).toMatchObject({
      "@type": "Organization",
      name: "MDS Rebar",
      url: "https://mds.example/",
    });
  });

  it("jobPostingLd maps the employment type and omits an empty deadline", () => {
    const ld = jobPostingLd({
      title: "Detailer",
      description: "Do detailing.",
      datePosted: "2026-09-01T00:00:00Z",
      validThrough: null,
      employmentType: "full_time",
      location: "Dubai",
    });
    expect(ld).toMatchObject({ "@type": "JobPosting", employmentType: "FULL_TIME" });
    expect(ld).not.toHaveProperty("validThrough");
    expect(ld.jobLocation).toBeDefined();
  });

  it("articleLd includes author and dates when present", () => {
    const ld = articleLd({
      headline: "Post",
      description: "d",
      datePublished: "2026-09-01T00:00:00Z",
      dateModified: "2026-09-02T00:00:00Z",
      author: "Sam Lee",
      url: "https://mds.example/news/post",
    });
    expect(ld).toMatchObject({
      "@type": "Article",
      headline: "Post",
      author: { "@type": "Person", name: "Sam Lee" },
      datePublished: "2026-09-01T00:00:00Z",
    });
  });
});
