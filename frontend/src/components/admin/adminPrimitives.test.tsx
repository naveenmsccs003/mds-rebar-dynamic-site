import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "../../api/envelope";
import { AdminDataTable, type Column } from "./AdminDataTable";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormDrawer } from "./FormDrawer";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { WorkflowBar } from "./WorkflowBar";

vi.mock("../../features/auth/usePermission", () => ({
  usePermissionChecker: () => (perm: string | string[]) => {
    const need = Array.isArray(perm) ? perm : [perm];
    // has `change` everywhere, but NOT `publish`
    return need.every((p) => p.includes("change_"));
  },
}));

afterEach(() => vi.clearAllMocks());

interface Row {
  id: number;
  name: string;
}
const cols: Column<Row>[] = [{ key: "name", header: "Name", render: (r) => r.name }];
const page = (rows: Row[]): Paginated<Row> => ({ count: rows.length, next: null, previous: null, results: rows });

const baseQuery = {
  data: undefined as Paginated<Row> | undefined,
  isPending: false,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
};

describe("AdminDataTable", () => {
  it("shows a skeleton while pending", () => {
    render(
      <AdminDataTable
        query={{ ...baseQuery, isPending: true }}
        columns={cols}
        rowKey={(r) => r.id}
        page={1}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the empty label for zero rows", () => {
    render(
      <AdminDataTable
        query={{ ...baseQuery, data: page([]) }}
        columns={cols}
        rowKey={(r) => r.id}
        page={1}
        onPageChange={vi.fn()}
        emptyLabel="Nothing"
      />,
    );
    expect(screen.getByText("Nothing")).toBeInTheDocument();
  });

  it("renders rows and fires onRowClick", async () => {
    const onRowClick = vi.fn();
    render(
      <AdminDataTable
        query={{ ...baseQuery, data: page([{ id: 7, name: "Hero" }]) }}
        columns={cols}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        page={1}
        onPageChange={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("Hero"));
    expect(onRowClick).toHaveBeenCalledWith({ id: 7, name: "Hero" });
  });

  it("shows an error state with retry", async () => {
    const refetch = vi.fn();
    render(
      <AdminDataTable
        query={{ ...baseQuery, isError: true, error: new Error("boom"), refetch }}
        columns={cols}
        rowKey={(r) => r.id}
        page={1}
        onPageChange={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("WorkflowBar", () => {
  it("renders a button per allowed transition and gates publish on the permission", () => {
    render(
      <WorkflowBar
        status="approved"
        allowedTransitions={["draft", "published", "archived"]}
        permBase="pages.pagesection"
        onTransition={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Back to draft" })).toBeEnabled();
    // publish needs pages.publish_pagesection, which the mock does not grant
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("passes the target + note to onTransition", async () => {
    const onTransition = vi.fn();
    render(
      <WorkflowBar
        status="draft"
        allowedTransitions={["review"]}
        permBase="pages.pagesection"
        onTransition={onTransition}
      />,
    );
    await userEvent.type(screen.getByLabelText(/note/i), "ready");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(onTransition).toHaveBeenCalledWith("review", "ready");
  });
});

describe("FormDrawer", () => {
  it("renders when open and closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <FormDrawer open title="Edit thing" onClose={onClose}>
        <p>body</p>
      </FormDrawer>,
    );
    expect(screen.getByRole("dialog", { name: "Edit thing" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <FormDrawer open={false} title="x" onClose={vi.fn()}>
        <p>body</p>
      </FormDrawer>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("VersionHistoryPanel", () => {
  it("lists versions and calls onRollback", async () => {
    const onRollback = vi.fn();
    render(
      <VersionHistoryPanel
        query={
          {
            isPending: false,
            isError: false,
            data: {
              count: 1,
              next: null,
              previous: null,
              results: [
                {
                  id: 3,
                  snapshot: {},
                  note: "edited",
                  edited_by_email: "ed@mds.example",
                  edited_at: "2026-09-01T00:00:00Z",
                },
              ],
            },
          } as never
        }
        canRollback
        rollingBackId={null}
        onRollback={onRollback}
      />,
    );
    expect(screen.getByText(/ed@mds.example/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /roll back/i }));
    expect(onRollback).toHaveBeenCalledWith(3);
  });
});

describe("ConfirmDialog", () => {
  it("confirms and cancels", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Delete?" onConfirm={onConfirm} onCancel={onCancel} confirmLabel="Delete" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});
