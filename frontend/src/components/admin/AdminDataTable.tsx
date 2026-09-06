/**
 * Server-paginated table for the admin lists (docs/UI_DESIGN_SYSTEM.md
 * — admin tables are always server-filtered + paginated, never a full
 * dataset pulled into the browser). Collapses a TanStack Query result
 * into loading / empty / error / rows, plus a `Pagination` footer.
 */
import type { ReactNode } from "react";

import type { Paginated } from "../../api/envelope";
import { PAGE_SIZE } from "../../api/request";
import { ErrorState } from "../ErrorState/ErrorState";
import { Pagination } from "../Pagination/Pagination";
import { Skeleton } from "../Skeleton/Skeleton";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
}

export interface AdminDataTableProps<T> {
  query: {
    data: Paginated<T> | undefined;
    isPending: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => unknown;
  };
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  page: number;
  onPageChange: (page: number) => void;
  emptyLabel?: string;
  /** Rendered above the table (a FilterBar, a "New" button, …). */
  toolbar?: ReactNode;
}

export function AdminDataTable<T>({
  query,
  columns,
  rowKey,
  onRowClick,
  page,
  onPageChange,
  emptyLabel = "Nothing here yet.",
  toolbar,
}: AdminDataTableProps<T>) {
  const data = query.data;
  return (
    <div className="admin-table">
      {toolbar && <div className="admin-table__toolbar">{toolbar}</div>}

      {query.isError ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => query.refetch()}
        />
      ) : query.isPending || !data ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Loading…</span>
          <Skeleton lines={6} />
        </div>
      ) : data.results.length === 0 ? (
        <p className="admin-muted">{emptyLabel}</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.results.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "admin-table__row--clickable" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter") onRowClick(row);
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key}>{c.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-table__footer">
            <p className="admin-muted">{data.count} total</p>
            <Pagination
              page={page}
              pageCount={Math.ceil(data.count / PAGE_SIZE)}
              onChange={onPageChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
