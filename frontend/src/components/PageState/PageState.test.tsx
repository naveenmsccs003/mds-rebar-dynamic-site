import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PageState } from "./PageState";

type Q = Parameters<typeof PageState<string[]>>[0]["query"];

const base: Q = {
  isPending: false,
  isError: false,
  data: undefined,
  error: null,
  refetch: vi.fn(),
};

describe("PageState", () => {
  it("shows the loading state while pending", () => {
    render(
      <PageState query={{ ...base, isPending: true }}>{() => <p>content</p>}</PageState>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an error with a working retry", async () => {
    const refetch = vi.fn();
    render(
      <PageState query={{ ...base, isError: true, error: new Error("boom"), refetch }}>
        {() => <p>content</p>}
      </PageState>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders the empty state when isEmpty matches", () => {
    render(
      <PageState
        query={{ ...base, data: [] }}
        isEmpty={(d) => d.length === 0}
        emptyState={<p>nothing here</p>}
      >
        {() => <p>content</p>}
      </PageState>,
    );
    expect(screen.getByText("nothing here")).toBeInTheDocument();
  });

  it("renders children with the data on success", () => {
    render(
      <PageState query={{ ...base, data: ["a", "b"] }}>
        {(d) => <p>{d.join(",")}</p>}
      </PageState>,
    );
    expect(screen.getByText("a,b")).toBeInTheDocument();
  });
});
