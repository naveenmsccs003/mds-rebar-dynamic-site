import { useState } from "react";

import { Button } from "../../components/Button/Button";
import type { Column } from "../../components/admin/AdminDataTable";
import { SimpleResourcePage } from "../admin-shared/SimpleResourcePage";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { Area, Bool, Select, Text } from "./formHelpers";
import { numOrNull } from "./formUtils";
import { resources as hooks } from "./hooks";
import type { ResourceRow } from "./types";

const CATEGORIES = [
  "brochure",
  "video",
  "sample_drawing",
  "technical_document",
  "case_study",
  "whitepaper",
].map((c) => ({ value: c, label: c }));

const columns: Column<ResourceRow>[] = [
  { key: "title", header: "Title", render: (r) => r.title },
  { key: "category", header: "Category", render: (r) => r.category },
  { key: "access", header: "Access", render: (r) => r.access_type },
  { key: "pub", header: "Published", render: (r) => (r.is_published ? "yes" : "no"), width: "90px" },
];

function ResourceForm({ row, onSaved }: { row: ResourceRow | null; onSaved: () => void }) {
  const create = hooks.useCreate();
  const update = hooks.useUpdate();
  const m = row ? update : create;
  const err = fieldErrorsFromApi(m.error);
  const [v, setV] = useState<Record<string, unknown>>({
    title: row?.title ?? "",
    slug: row?.slug ?? "",
    description: row?.description ?? "",
    category: row?.category ?? "brochure",
    external_url: row?.external_url ?? "",
    access_type: row?.access_type ?? "public",
    is_published: row?.is_published ?? false,
    file: row?.file ?? "",
  });
  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...v, file: numOrNull(v.file) };
    if (row) update.mutate({ id: row.id, body }, { onSuccess: onSaved });
    else create.mutate(body, { onSuccess: onSaved });
  }

  return (
    <form className="form" onSubmit={submit}>
      {formErrorFromApi(m.error) && (
        <p className="form__error form__error--top" role="alert">{formErrorFromApi(m.error)}</p>
      )}
      <Text name="title" label="Title" values={v} set={set} errors={err} />
      <Text name="slug" label="Slug" values={v} set={set} errors={err} />
      <Select name="category" label="Category" options={CATEGORIES} values={v} set={set} errors={err} />
      <Area name="description" label="Description" rows={3} values={v} set={set} errors={err} />
      <Text name="external_url" label="External URL" values={v} set={set} errors={err} />
      <Text name="file" label="Document id (media picker in A5)" type="number" values={v} set={set} errors={err} />
      <Select
        name="access_type"
        label="Access"
        options={[
          { value: "public", label: "public" },
          { value: "restricted", label: "restricted (Knowledge Base)" },
        ]}
        values={v}
        set={set}
        errors={err}
      />
      <Bool name="is_published" label="Published" values={v} set={set} />
      <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
    </form>
  );
}

export function ResourcesPage() {
  return (
    <SimpleResourcePage<ResourceRow>
      title="Resources"
      addPermission="resources.add_resource"
      useList={hooks.useList}
      columns={columns}
      newLabel="New resource"
      renderForm={(row, onSaved) => <ResourceForm row={row} onSaved={onSaved} />}
    />
  );
}
