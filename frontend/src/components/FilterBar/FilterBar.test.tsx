import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterBar, type Filter } from "./FilterBar";

describe("FilterBar", () => {
  it("renders each control type and reports changes", async () => {
    const onText = vi.fn();
    const onSelect = vi.fn();
    const onCheck = vi.fn();
    const filters: Filter[] = [
      { kind: "text", name: "q", label: "Search", value: "", onChange: onText },
      {
        kind: "select",
        name: "cat",
        label: "Category",
        value: "",
        options: [{ value: "a", label: "Alpha" }],
        onChange: onSelect,
      },
      { kind: "checkbox", name: "featured", label: "Featured only", checked: false, onChange: onCheck },
    ];
    render(<FilterBar filters={filters} />);

    expect(screen.getByRole("search", { name: "Filters" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search"), "x");
    expect(onText).toHaveBeenCalledWith("x");

    await userEvent.selectOptions(screen.getByLabelText("Category"), "a");
    expect(onSelect).toHaveBeenCalledWith("a");

    await userEvent.click(screen.getByLabelText("Featured only"));
    expect(onCheck).toHaveBeenCalledWith(true);
  });
});
