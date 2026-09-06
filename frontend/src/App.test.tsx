import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

/**
 * Smoke test: the app shell boots — router, query provider and the
 * public layout mount, and the home route renders inside it. The
 * homepage's CMS fetch has no server in this environment, so we assert
 * the always-present chrome rather than fetched content (HomePage's own
 * data states are covered in features/home/HomePage.test.tsx).
 */
describe("App", () => {
  it("mounts the public layout with primary navigation", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "MDS Rebar" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
