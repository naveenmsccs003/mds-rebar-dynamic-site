import { useState } from "react";

import { Button } from "../../components/Button/Button";
import type { Column } from "../../components/admin/AdminDataTable";
import { CheckboxField, TextField } from "../../components/admin/FormField";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { SimpleResourcePage } from "../admin-shared/SimpleResourcePage";
import { redirects as hooks } from "./hooks";
import type { RedirectRow } from "./types";

const columns: Column<RedirectRow>[] = [
  { key: "from", header: "Old path", render: (r) => r.old_path },
  { key: "to", header: "New path", render: (r) => r.new_path },
  { key: "perm", header: "Type", render: (r) => (r.is_permanent ? "301" : "302"), width: "80px" },
];

function RedirectForm({ row, onSaved }: { row: RedirectRow | null; onSaved: () => void }) {
  const create = hooks.useCreate();
  const update = hooks.useUpdate();
  const m = row ? update : create;
  const err = fieldErrorsFromApi(m.error);
  const [form, setForm] = useState({
    old_path: row?.old_path ?? "",
    new_path: row?.new_path ?? "",
    is_permanent: row?.is_permanent ?? true,
    note: row?.note ?? "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (row) update.mutate({ id: row.id, body: form }, { onSuccess: onSaved });
    else create.mutate(form, { onSuccess: onSaved });
  }

  return (
    <form className="form" onSubmit={submit}>
      {formErrorFromApi(m.error) && (
        <p className="form__error form__error--top" role="alert">{formErrorFromApi(m.error)}</p>
      )}
      <TextField label="Old path" value={form.old_path} error={err.old_path}
        onChange={(e) => setForm((f) => ({ ...f, old_path: e.target.value }))} />
      <TextField label="New path" value={form.new_path} error={err.new_path}
        onChange={(e) => setForm((f) => ({ ...f, new_path: e.target.value }))} />
      <CheckboxField label="Permanent (301)" checked={form.is_permanent}
        onChange={(e) => setForm((f) => ({ ...f, is_permanent: e.target.checked }))} />
      <TextField label="Note" value={form.note} error={err.note}
        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
      <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
    </form>
  );
}

export function RedirectsPage() {
  return (
    <SimpleResourcePage<RedirectRow>
      title="Redirects"
      addPermission="pages.add_redirect"
      useList={hooks.useList}
      columns={columns}
      newLabel="New redirect"
      renderForm={(row, onSaved) => <RedirectForm row={row} onSaved={onSaved} />}
    />
  );
}
