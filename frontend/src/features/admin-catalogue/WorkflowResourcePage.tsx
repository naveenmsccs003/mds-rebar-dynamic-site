/**
 * Table + edit/create drawer for a publishing-workflow admin resource
 * (services / portfolio / news). The caller supplies the columns, the
 * form fields, and how to turn form state into a request body; this owns
 * the list query, the drawer, the create/update mutations, and — when
 * editing — the `WorkflowBar` + `VersionHistoryPanel`.
 */
import { type ReactNode, useState } from "react";

import type { UseQueryResult } from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import { ApiRequestError } from "../../api/request";
import type { ContentVersion } from "../admin-shared/crud";
import { Button } from "../../components/Button/Button";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { VersionHistoryPanel } from "../../components/admin/VersionHistoryPanel";
import { WorkflowBar } from "../../components/admin/WorkflowBar";
import { fieldErrorsFromApi, formErrorFromApi, type FieldErrors } from "../shared/publicForm";
import { useListParams } from "../shared/useListParams";
import { usePermission, usePermissionChecker } from "../auth/usePermission";

type Values = Record<string, unknown>;

interface WorkflowRow {
  id: number;
  status: string;
  allowed_transitions: string[];
}

type MutationLike<V> = {
  mutate: (variables: V, options?: object) => void;
  isPending: boolean;
  error: unknown;
  variables?: V;
};

interface Hooks<TRow extends WorkflowRow> {
  useList: (params: Record<string, string>) => {
    data: Paginated<TRow> | undefined;
    isPending: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => unknown;
  };
  useCreate: () => MutationLike<Values>;
  useUpdate: () => MutationLike<{ id: number; body: Values }>;
  useTransition: () => MutationLike<{ id: number; to: string; note: string }>;
  useVersions: (id: number | null) => UseQueryResult<Paginated<ContentVersion>>;
  useRollback: () => MutationLike<{ id: number; versionId: number }>;
}

export interface WorkflowResourcePageProps<TRow extends WorkflowRow> {
  title: string;
  /** e.g. `services.service` — drives the add-permission + workflow perms. */
  permBase: string;
  hooks: Hooks<TRow>;
  columns: Column<TRow>[];
  initial: (row: TRow | null) => Values;
  build: (values: Values) => Values;
  renderFields: (
    values: Values,
    set: (key: string, value: unknown) => void,
    errors: FieldErrors,
  ) => ReactNode;
}

export function WorkflowResourcePage<TRow extends WorkflowRow>({
  title,
  permBase,
  hooks,
  columns,
  initial,
  build,
  renderFields,
}: WorkflowResourcePageProps<TRow>) {
  const [app, model] = permBase.split(".");
  const { page, setPage, filterParams } = useListParams();
  const query = hooks.useList(page > 1 ? { ...filterParams, page: String(page) } : filterParams);
  const canAdd = usePermission(`${app}.add_${model}`);
  const can = usePermissionChecker();

  const [editing, setEditing] = useState<TRow | null | undefined>(undefined);
  const [values, setValues] = useState<Values>({});
  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  function open(row: TRow | null) {
    setValues(initial(row));
    setEditing(row);
  }
  function close() {
    setEditing(undefined);
  }

  const create = hooks.useCreate();
  const update = hooks.useUpdate();
  const transition = hooks.useTransition();
  const rollback = hooks.useRollback();
  const versions = hooks.useVersions(editing ? editing.id : null);

  const mutation = editing ? update : create;
  const fieldErr = fieldErrorsFromApi(mutation.error);
  const formErr = formErrorFromApi(mutation.error);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = build(values);
    if (editing) update.mutate({ id: editing.id, body }, { onSuccess: close });
    else create.mutate(body, { onSuccess: close });
  }

  return (
    <>
      <SEOHead title={title} noindex />
      <h1>{title}</h1>
      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={open}
        page={page}
        onPageChange={setPage}
        toolbar={
          canAdd ? (
            <Button type="button" onClick={() => open(null)}>
              New
            </Button>
          ) : undefined
        }
      />

      <FormDrawer open={editing !== undefined} title={editing ? "Edit" : "New"} onClose={close}>
        {editing !== undefined && (
          <div className="admin-form-stack">
            <form className="form" onSubmit={submit}>
              {formErr && (
                <p className="form__error form__error--top" role="alert">
                  {formErr}
                </p>
              )}
              {renderFields(values, set, fieldErr)}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
            </form>

            {editing && (
              <>
                <section className="admin-panel" aria-label="Publishing workflow">
                  <h3>Workflow</h3>
                  <WorkflowBar
                    status={editing.status}
                    allowedTransitions={editing.allowed_transitions}
                    permBase={permBase}
                    busy={transition.isPending}
                    onTransition={(to, note) =>
                      transition.mutate({ id: editing.id, to, note }, { onSuccess: close })
                    }
                  />
                  {transition.error instanceof ApiRequestError && (
                    <p className="form__error" role="alert">
                      {transition.error.message}
                    </p>
                  )}
                </section>
                <section className="admin-panel" aria-label="Version history">
                  <h3>Version history</h3>
                  <VersionHistoryPanel
                    query={versions}
                    canRollback={can(`${app}.change_${model}`)}
                    rollingBackId={
                      rollback.isPending ? rollback.variables?.versionId ?? null : null
                    }
                    onRollback={(versionId) =>
                      rollback.mutate({ id: editing.id, versionId }, { onSuccess: close })
                    }
                  />
                </section>
              </>
            )}
          </div>
        )}
      </FormDrawer>
    </>
  );
}
