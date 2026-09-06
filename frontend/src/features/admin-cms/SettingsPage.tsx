import { useState } from "react";

import { Button } from "../../components/Button/Button";
import type { Column } from "../../components/admin/AdminDataTable";
import { SelectField, TextField } from "../../components/admin/FormField";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { SimpleResourcePage } from "../admin-shared/SimpleResourcePage";
import { settings as hooks } from "./hooks";
import type { SettingValueType, SiteSettingRow } from "./types";

const TYPES: SettingValueType[] = ["text", "number", "boolean", "json"];

const columns: Column<SiteSettingRow>[] = [
  { key: "key", header: "Key", render: (r) => r.key },
  { key: "type", header: "Type", render: (r) => r.value_type, width: "100px" },
  { key: "value", header: "Value", render: (r) => (r.value.length > 60 ? `${r.value.slice(0, 60)}…` : r.value) },
];

function SettingForm({ row, onSaved }: { row: SiteSettingRow | null; onSaved: () => void }) {
  const create = hooks.useCreate();
  const update = hooks.useUpdate();
  const m = row ? update : create;
  const err = fieldErrorsFromApi(m.error);
  const formErr = formErrorFromApi(m.error);
  const [form, setForm] = useState({
    key: row?.key ?? "",
    value: row?.value ?? "",
    value_type: row?.value_type ?? "text",
    description: row?.description ?? "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (row) update.mutate({ id: row.id, body: form }, { onSuccess: onSaved });
    else create.mutate(form, { onSuccess: onSaved });
  }

  return (
    <form className="form" onSubmit={submit}>
      {formErr && <p className="form__error form__error--top" role="alert">{formErr}</p>}
      <TextField label="Key" value={form.key} error={err.key} disabled={!!row}
        onChange={(e) => set("key", e.target.value)} />
      <SelectField label="Type" value={form.value_type} error={err.value_type}
        options={TYPES.map((t) => ({ value: t, label: t }))}
        onChange={(e) => set("value_type", e.target.value)} />
      <label className="form__field">
        <span>Value</span>
        <textarea rows={4} value={form.value} aria-invalid={err.value ? true : undefined}
          onChange={(e) => set("value", e.target.value)} />
        {err.value && <span className="form__error">{err.value}</span>}
      </label>
      <TextField label="Description" value={form.description} error={err.description}
        onChange={(e) => set("description", e.target.value)} />
      <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
    </form>
  );
}

export function SettingsPage() {
  return (
    <SimpleResourcePage<SiteSettingRow>
      title="Site settings"
      addPermission="pages.add_sitesetting"
      useList={hooks.useList}
      columns={columns}
      newLabel="New setting"
      renderForm={(row, onSaved) => <SettingForm row={row} onSaved={onSaved} />}
    />
  );
}
