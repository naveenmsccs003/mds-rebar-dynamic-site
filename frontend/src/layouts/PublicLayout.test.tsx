import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";

import { renderWithProviders } from "../test/renderWithProviders";
import { PublicLayout } from "./PublicLayout";

function renderLayout(route = "/") {
  return renderWithProviders(
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<h1>Home content</h1>} />
        <Route path="/about" element={<h1>About content</h1>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe("PublicLayout", () => {
  it("exposes a skip link, primary nav and a labelled main landmark", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("link", { name: "Request a Quote" })).toHaveAttribute(
      "href",
      "/request-quote",
    );
  });

  it("toggles the mobile menu via an aria-expanded button", async () => {
    renderLayout();
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("closes the menu after navigating", async () => {
    renderLayout();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    const primaryNav = screen.getByRole("navigation", { name: "Primary" });
    await userEvent.click(within(primaryNav).getByRole("link", { name: "About" }));

    expect(await screen.findByRole("heading", { name: "About content" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });
});
