import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SEOHead } from "./SEOHead";

function metaContent(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute("content") ?? null;
}

describe("SEOHead", () => {
  it("hoists title, description, canonical and OG tags into <head>", async () => {
    render(
      <SEOHead
        title="About"
        description="Who we are"
        canonicalPath="/about"
        ogImage="https://cdn.example/og.png"
      />,
    );

    await waitFor(() => expect(document.title).toBe("About — MDS Rebar"));
    expect(metaContent('meta[name="description"]')).toBe("Who we are");
    expect(metaContent('meta[property="og:title"]')).toBe("About — MDS Rebar");
    expect(metaContent('meta[property="og:image"]')).toBe("https://cdn.example/og.png");
    expect(metaContent('meta[name="twitter:card"]')).toBe("summary_large_image");

    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute("href")).toMatch(/\/about$/);
  });

  it("uses the bare site name as the title for the homepage", async () => {
    render(<SEOHead title="MDS Rebar" />);
    await waitFor(() => expect(document.title).toBe("MDS Rebar"));
  });

  it("emits a noindex robots tag when asked", async () => {
    render(<SEOHead title="Page not found" noindex />);
    await waitFor(() =>
      expect(metaContent('meta[name="robots"]')).toBe("noindex,nofollow"),
    );
  });
});
