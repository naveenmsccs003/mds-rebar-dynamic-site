import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

/**
 * Phase 1 smoke test: the app shell boots, routing + query provider are
 * wired correctly, and the home route renders without error.
 */
describe("App", () => {
  it("renders the home route inside the public layout", () => {
    render(<App />);
    expect(screen.getByText("MDS Rebar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
  });
});
