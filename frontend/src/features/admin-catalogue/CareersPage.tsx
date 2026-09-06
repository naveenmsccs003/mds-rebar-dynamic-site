import { useState } from "react";

import { Button } from "../../components/Button/Button";
import type { Column } from "../../components/admin/AdminDataTable";
import { SimpleResourcePage } from "../admin-shared/SimpleResourcePage";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { Area, Bool, Select, Text } from "./formHelpers";
import { careers as hooks } from "./hooks";
import type { CareersRow } from "./types";

const EMPLOYMENT = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const columns: Column<CareersRow>[] = [
  { key: "title", header: "Title", render: (r) => r.title },
  { key: "dept", header: "Department", render: (r) => r.department || "—" },
  { key: "type", header: "Type", render: (r) => r.employment_type },
  { key: "active", header: "Active", render: (r) => (r.is_active ? "yes" : "no"), width: "80px" },
];

function CareerForm({ row, onSaved }: { row: CareersRow | null; onSaved: () => void }) {
  const create = hooks.useCreate();
  const update = hooks.useUpdate();
  const m = row ? update : create;
  const err = fieldErrorsFromApi(m.error);
  const [v, setV] = useState<Record<string, unknown>>({
    title: row?.title ?? "",
    slug: row?.slug ?? "",
    department: row?.department ?? "",
    location: row?.location ?? "",
    employment_type: row?.employment_type ?? "full_time",
    experience: row?.experience ?? "",
    skills: row?.skills ?? "",
    description: row?.description ?? "",
    responsibilities: row?.responsibilities ?? "",
    requirements: row?.requirements ?? "",
    benefits: row?.benefits ?? "",
    application_deadline: row?.application_deadline?.slice(0, 10) ?? "",
    is_active: row?.is_active ?? true,
  });
  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...v, application_deadline: v.application_deadline || null };
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
      <Text name="department" label="Department" values={v} set={set} errors={err} />
      <Text name="location" label="Location" values={v} set={set} errors={err} />
      <Select name="employment_type" label="Type" options={EMPLOYMENT} values={v} set={set} errors={err} />
      <Text name="experience" label="Experience" values={v} set={set} errors={err} />
      <Text name="skills" label="Skills (comma-separated)" values={v} set={set} errors={err} />
      <Text name="application_deadline" label="Application deadline" type="date" values={v} set={set} errors={err} />
      <Area name="description" label="About the role" rows={4} values={v} set={set} errors={err} />
      <Area name="responsibilities" label="Responsibilities" rows={3} values={v} set={set} errors={err} />
      <Area name="requirements" label="Requirements" rows={3} values={v} set={set} errors={err} />
      <Area name="benefits" label="Benefits" rows={3} values={v} set={set} errors={err} />
      <Bool name="is_active" label="Active (accepting applications)" values={v} set={set} />
      <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
    </form>
  );
}

export function CareersPage() {
  return (
    <SimpleResourcePage<CareersRow>
      title="Careers"
      addPermission="careers.add_jobposting"
      useList={hooks.useList}
      columns={columns}
      newLabel="New posting"
      renderForm={(row, onSaved) => <CareerForm row={row} onSaved={onSaved} />}
    />
  );
}
