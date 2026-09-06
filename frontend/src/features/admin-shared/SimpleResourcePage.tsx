/**
 * Table + create/edit drawer for a plain (no-workflow) admin resource.
 * The caller supplies the columns and a form renderer; this owns the
 * list query, pagination, and the open/close state.
 */
import { type ReactNode, useState } from "react";

import type { Paginated } from "../../api/envelope";
import { Button } from "../../components/Button/Button";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { useListParams } from "../shared/useListParams";
import { usePermission } from "../auth/usePermission";

interface Props<T extends { id: number }> {
  title: string;
  addPermission: string;
  useList: (params: Record<string, string>) => {
    data: Paginated<T> | undefined;
    isPending: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => unknown;
  };
  columns: Column<T>[];
  /** `row === null` means "create". */
  renderForm: (row: T | null, onSaved: () => void) => ReactNode;
  newLabel?: string;
}

export function SimpleResourcePage<T extends { id: number }>({
  title,
  addPermission,
  useList,
  columns,
  renderForm,
  newLabel = "New",
}: Props<T>) {
  const { page, setPage, filterParams } = useListParams();
  const query = useList(page > 1 ? { ...filterParams, page: String(page) } : filterParams);
  const canAdd = usePermission(addPermission);
  const [editing, setEditing] = useState<T | null | undefined>(undefined);

  return (
    <>
      <SEOHead title={title} noindex />
      <h1>{title}</h1>
      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setEditing(r)}
        page={page}
        onPageChange={setPage}
        toolbar={
          canAdd ? (
            <Button type="button" onClick={() => setEditing(null)}>
              {newLabel}
            </Button>
          ) : undefined
        }
      />
      <FormDrawer
        open={editing !== undefined}
        title={editing ? `Edit` : newLabel}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && renderForm(editing, () => setEditing(undefined))}
      </FormDrawer>
    </>
  );
}
