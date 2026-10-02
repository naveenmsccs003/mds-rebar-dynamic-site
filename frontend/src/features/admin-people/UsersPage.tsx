/**
 * Administration → Users (docs/RBAC_DESIGN.md, spec §21). Create a staff
 * account (no password → the server emails a set-password link), edit
 * name / staff flag / roles, and deactivate or reactivate. There is no
 * delete: accounts are retired with `is_active=false` so their audit
 * history keeps pointing at a real user (spec §78).
 */
import { useState } from "react";

import { ApiRequestError } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { DetailList } from "../../components/admin/DetailList";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { CheckboxField, TextField } from "../../components/admin/FormField";
import { useSession } from "../auth/hooks";
import { usePermission } from "../auth/usePermission";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { useListParams } from "../shared/useListParams";
import { useRoles, users as hooks } from "./hooks";
import type { UserRow } from "./types";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const columns: Column<UserRow>[] = [
  { key: "email", header: "Email", render: (r) => r.email },
  { key: "name", header: "Name", render: (r) => r.full_name || "—" },
  { key: "roles", header: "Roles", render: (r) => (r.roles.length ? r.roles.join(", ") : "—") },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <span className={`status-pill status-pill--${r.is_active ? "active" : "inactive"}`}>
        {r.is_active ? (r.is_locked ? "Locked" : "Active") : "Inactive"}
      </span>
    ),
  },
  { key: "login", header: "Last sign-in", render: (r) => fmtDateTime(r.last_login) || "Never" },
];

function RolePicker({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
  error?: string;
}) {
  const roles = useRoles();
  const toggle = (name: string, on: boolean) =>
    onChange(on ? [...value, name].sort() : value.filter((r) => r !== name));

  return (
    <fieldset className="form__field" disabled={disabled}>
      <legend>Roles</legend>
      {roles.isPending && <p className="admin-muted">Loading roles…</p>}
      {roles.isError && <p className="form__error">Roles could not be loaded.</p>}
      {roles.data?.results.map((r) => (
        <CheckboxField
          key={r.id}
          label={r.name}
          checked={value.includes(r.name)}
          onChange={(e) => toggle(r.name, e.target.checked)}
        />
      ))}
      {error && <span className="form__error">{error}</span>}
    </fieldset>
  );
}

function CreateForm({ onCreated }: { onCreated: (user: UserRow, emailed: boolean) => void }) {
  const create = hooks.useCreate();
  const err = fieldErrorsFromApi(create.error);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [isStaff, setIsStaff] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      is_active: true,
      is_staff: isStaff,
      roles,
      ...(password ? { password } : {}),
    };
    create.mutate(body, { onSuccess: (user) => onCreated(user, !password) });
  }

  return (
    <form className="form" onSubmit={submit}>
      {formErrorFromApi(create.error) && (
        <p className="form__error form__error--top" role="alert">{formErrorFromApi(create.error)}</p>
      )}
      <TextField label="Email" type="email" required value={email} error={err.email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="First name" value={firstName} error={err.first_name} onChange={(e) => setFirstName(e.target.value)} />
      <TextField label="Last name" value={lastName} error={err.last_name} onChange={(e) => setLastName(e.target.value)} />
      <TextField
        label="Initial password (optional)"
        type="password"
        autoComplete="new-password"
        value={password}
        error={err.password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <p className="admin-muted">Leave the password blank to email the user a link to set their own.</p>
      <CheckboxField label="Staff (can sign in to the admin)" checked={isStaff} onChange={(e) => setIsStaff(e.target.checked)} />
      <RolePicker value={roles} onChange={setRoles} error={err.roles} />
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}

function EditForm({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const update = hooks.useUpdate();
  const canChange = usePermission("users.change_user");
  const { data: session } = useSession();
  const isSelf = session?.id === user.id;
  const err = fieldErrorsFromApi(update.error);
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [isStaff, setIsStaff] = useState(user.is_staff);
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [confirming, setConfirming] = useState(false);

  const dirty =
    firstName !== user.first_name ||
    lastName !== user.last_name ||
    isStaff !== user.is_staff ||
    roles.join() !== user.roles.join();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    update.mutate(
      { id: user.id, body: { first_name: firstName.trim(), last_name: lastName.trim(), is_staff: isStaff, roles } },
      { onSuccess: onDone },
    );
  }

  function toggleActive() {
    update.mutate(
      { id: user.id, body: { is_active: !user.is_active } },
      { onSuccess: () => { setConfirming(false); onDone(); } },
    );
  }

  return (
    <div className="admin-form-stack">
      <DetailList
        rows={[
          { label: "Email", value: user.email },
          { label: "Status", value: user.is_active ? (user.is_locked ? "Active (locked out)" : "Active") : "Inactive" },
          { label: "Last sign-in", value: fmtDateTime(user.last_login) || "Never", keepEmpty: true },
          { label: "Last sign-in IP", value: user.last_login_ip },
          { label: "Created", value: fmtDateTime(user.created_at) },
        ]}
      />
      <section className="admin-panel" aria-label="Profile and roles">
        <h3>Profile & roles</h3>
        <form className="form" onSubmit={submit}>
          {formErrorFromApi(update.error) && (
            <p className="form__error form__error--top" role="alert">{formErrorFromApi(update.error)}</p>
          )}
          <fieldset className="form__fieldset" disabled={!canChange}>
            <TextField label="First name" value={firstName} error={err.first_name} onChange={(e) => setFirstName(e.target.value)} />
            <TextField label="Last name" value={lastName} error={err.last_name} onChange={(e) => setLastName(e.target.value)} />
            <CheckboxField label="Staff (can sign in to the admin)" checked={isStaff} onChange={(e) => setIsStaff(e.target.checked)} />
          </fieldset>
          <RolePicker value={roles} onChange={setRoles} disabled={!canChange} error={err.roles} />
          {!canChange && <p className="admin-muted">Requires users.change_user.</p>}
          <Button type="submit" disabled={!canChange || !dirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </section>
      {canChange && (
        <section className="admin-panel" aria-label="Account status">
          <h3>{user.is_active ? "Deactivate" : "Reactivate"}</h3>
          <p className="admin-muted">
            {user.is_active
              ? "Signs the user out of the admin and blocks future sign-ins. Their history is kept; you can reactivate them later."
              : "Lets this user sign in again with their existing roles."}
          </p>
          {isSelf && user.is_active && (
            <p className="admin-muted">You can’t deactivate your own account.</p>
          )}
          <Button
            type="button"
            variant="secondary"
            className={user.is_active ? "button--danger" : undefined}
            disabled={(isSelf && user.is_active) || update.isPending}
            onClick={() => (user.is_active ? setConfirming(true) : toggleActive())}
          >
            {user.is_active ? "Deactivate user" : "Reactivate user"}
          </Button>
          {update.error instanceof ApiRequestError && !dirty && (
            <p className="form__error" role="alert">{update.error.message}</p>
          )}
        </section>
      )}
      <ConfirmDialog
        open={confirming}
        title="Deactivate this user?"
        body={`${user.email} will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        destructive
        busy={update.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={toggleActive}
      />
    </div>
  );
}

export function UsersPage() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = hooks.useList(page > 1 ? { ...filterParams, page: String(page) } : filterParams);
  const roles = useRoles();
  const canAdd = usePermission("users.add_user");
  const [open, setOpen] = useState<UserRow | null | undefined>(undefined);
  const [notice, setNotice] = useState("");

  const filters: Filter[] = [
    { kind: "text", name: "search", label: "Search", value: get("search"), placeholder: "Email or name", onChange: (v) => setParam("search", v) },
    {
      kind: "select",
      name: "groups__name",
      label: "Role",
      value: get("groups__name"),
      options: (roles.data?.results ?? []).map((r) => ({ value: r.name, label: r.name })),
      onChange: (v) => setParam("groups__name", v),
    },
    {
      kind: "select",
      name: "is_active",
      label: "Status",
      value: get("is_active"),
      options: [
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ],
      onChange: (v) => setParam("is_active", v),
    },
  ];

  return (
    <>
      <SEOHead title="Users" noindex />
      <h1>Users</h1>
      {notice && (
        <p className="form__success" role="status">
          {notice}
        </p>
      )}
      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpen(r)}
        page={page}
        onPageChange={setPage}
        emptyLabel="No users match those filters."
        toolbar={
          <>
            <FilterBar filters={filters} />
            {canAdd && (
              <Button type="button" onClick={() => setOpen(null)}>
                New user
              </Button>
            )}
          </>
        }
      />
      <FormDrawer
        open={open !== undefined}
        title={open ? open.email : "New user"}
        onClose={() => setOpen(undefined)}
      >
        {open === null && (
          <CreateForm
            onCreated={(user, emailed) => {
              setOpen(undefined);
              setNotice(
                emailed
                  ? `Created ${user.email}. A set-password email is on its way to them.`
                  : `Created ${user.email}.`,
              );
            }}
          />
        )}
        {open && <EditForm key={open.id} user={open} onDone={() => setOpen(undefined)} />}
      </FormDrawer>
    </>
  );
}
