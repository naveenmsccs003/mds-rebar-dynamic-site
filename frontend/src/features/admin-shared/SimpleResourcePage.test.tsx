import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SimpleResourcePage } from "./SimpleResourcePage";

// Can add tags, can't change them.
vi.mock("../auth/usePermission", () => ({
  usePermission: (perm: string) => perm === "pages.add_tag",
}));

const row = { id: 1, name: "Rebar" };
const useList = () => ({
  data: { count: 1, next: null, previous: null, results: [row] },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
});

function renderPage() {
  render(
    <MemoryRouter>
      <SimpleResourcePage<typeof row>
        title="Tags"
        addPermission="pages.add_tag"
        useList={useList}
        columns={[{ key: "name", header: "Name", render: (r) => r.name }]}
        newLabel="New tag"
        renderForm={() => (
          <form>
            <input aria-label="Name" />
            <button type="submit">Save</button>
          </form>
        )}
      />
    </MemoryRouter>,
  );
}

describe("SimpleResourcePage permission gating", () => {
  it("opens an existing row read-only without the change permission", async () => {
    renderPage();
    await userEvent.click(screen.getByText("Rebar"));
    expect(screen.getByText("Read-only: requires pages.change_tag.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("still lets the role create with the add permission", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "New tag" }));
    expect(screen.getByLabelText("Name")).toBeEnabled();
    expect(screen.queryByText(/Read-only/)).toBeNull();
  });
});
