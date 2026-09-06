import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MediaRef } from "../../features/services/types";
import { MediaImage } from "./MediaImage";

const ref = (over: Partial<MediaRef>): MediaRef => ({
  id: 1,
  url: null,
  alt_text: "Hero",
  caption: "",
  width: null,
  height: null,
  ...over,
});

describe("MediaImage", () => {
  it("renders an <img> once the asset has a resolved url", () => {
    render(<MediaImage media={ref({ url: "https://cdn.example/hero.png", width: 800, height: 400 })} />);
    const img = screen.getByRole("img", { name: "Hero" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "https://cdn.example/hero.png");
  });

  it("renders a labelled placeholder while there is no url", () => {
    render(<MediaImage media={ref({ url: null })} />);
    const el = screen.getByRole("img", { name: "Hero" });
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveTextContent("Hero");
  });

  it("falls back to fallbackAlt when the asset has no alt text", () => {
    render(<MediaImage media={ref({ url: null, alt_text: "" })} fallbackAlt="Project image" />);
    expect(screen.getByRole("img", { name: "Project image" })).toBeInTheDocument();
  });

  it("handles a null media prop", () => {
    render(<MediaImage media={null} fallbackAlt="Nothing yet" />);
    expect(screen.getByRole("img", { name: "Nothing yet" })).toBeInTheDocument();
  });
});
