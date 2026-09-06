import { useState } from "react";

import { Button } from "../../components/Button/Button";
import type { Column } from "../../components/admin/AdminDataTable";
import { TextField } from "../../components/admin/FormField";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { SimpleResourcePage } from "./SimpleResourcePage";
import { tags as hooks } from "./hooks";
import type { TagRow } from "./types";

const columns: Column<TagRow>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "slug", header: "Slug", render: (r) => r.slug },
];

function TagForm({ row, onSaved }: { row: TagRow | null; onSaved: () => void }) {
  const create = hooks.useCreate();
  const update = hooks.useUpdate();
  const m = row ? update : create;
  const err = fieldErrorsFromApi(m.error);
  const [name, setName] = useState(row?.name ?? "");
  const [slug, setSlug] = useState(row?.slug ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { name, slug };
    if (row) update.mutate({ id: row.id, body }, { onSuccess: onSaved });
    else create.mutate(body, { onSuccess: onSaved });
  }

  return (
    <form className="form" onSubmit={submit}>
      {formErrorFromApi(m.error) && (
        <p className="form__error form__error--top" role="alert">{formErrorFromApi(m.error)}</p>
      )}
      <TextField label="Name" value={name} error={err.name} onChange={(e) => setName(e.target.value)} />
      <TextField label="Slug" value={slug} error={err.slug} onChange={(e) => setSlug(e.target.value)} />
      <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
    </form>
  );
}

export function TagsPage() {
  return (
    <SimpleResourcePage<TagRow>
      title="Tags"
      addPermission="pages.add_tag"
      useList={hooks.useList}
      columns={columns}
      newLabel="New tag"
      renderForm={(row, onSaved) => <TagForm row={row} onSaved={onSaved} />}
    />
  );
}
