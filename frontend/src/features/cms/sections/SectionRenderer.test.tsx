import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../../test/renderWithProviders";
import type { PageSections } from "../types";
import { SectionRenderer } from "./SectionRenderer";

describe("SectionRenderer", () => {
  it("renders sections in display_order regardless of array order", () => {
    const sections: PageSections = [
      { section_key: "cta", display_order: 3, published_at: null, content: { heading: "Third" } },
      { section_key: "hero", display_order: 1, published_at: null, content: { heading: "First" } },
      { section_key: "prose", display_order: 2, published_at: null, content: { heading: "Second", body_html: "<p>x</p>" } },
    ];
    renderWithProviders(<SectionRenderer sections={sections} />);

    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(["First", "Second", "Third"]);
  });

  it("maps a hero section to an <h1> and a dark band", () => {
    renderWithProviders(
      <SectionRenderer
        sections={[
          {
            section_key: "hero",
            display_order: 1,
            published_at: null,
            content: { heading: "Welcome", subheading: "sub", cta_label: "Go", cta_href: "/about" },
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/about");
  });

  it("falls back gracefully for an unknown section_key", () => {
    renderWithProviders(
      <SectionRenderer
        sections={[
          { section_key: "totally_new_kind", display_order: 1, published_at: null, content: { heading: "Still shown", body_html: "<p>body</p>" } },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Still shown" })).toBeInTheDocument();
  });

  it("renders nothing for an unknown section with no usable content", () => {
    const { container } = renderWithProviders(
      <SectionRenderer
        sections={[{ section_key: "mystery", display_order: 1, published_at: null, content: { foo: 1 } }]}
      />,
    );
    expect(container.querySelector("section")).toBeNull();
  });
});
