/**
 * Administration → Roles (docs/RBAC_DESIGN.md). A read-only reference of
 * the ten seeded roles and the permission codenames each one grants.
 * Changing a role's permissions is a code change
 * (`apps.roles.role_permissions` + `manage.py sync_roles`); giving a
 * person a role happens on the Users screen.
 */
import { useState } from "react";

import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { useRoles } from "./hooks";
import type { RoleRow } from "./types";

const columns: Column<RoleRow>[] = [
  { key: "name", header: "Role", render: (r) => r.name },
  { key: "users", header: "Users", render: (r) => r.user_count, width: "100px" },
  { key: "perms", header: "Permissions", render: (r) => r.permissions.length, width: "140px" },
];

/** `services.change_service` → grouped under `services`. */
function groupByApp(codenames: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const code of codenames) {
    const [app, perm = code] = code.split(".", 2);
    groups.set(app, [...(groups.get(app) ?? []), perm]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function RoleDetail({ role }: { role: RoleRow }) {
  if (role.permissions.length === 0) {
    return <p className="admin-muted">This role grants no model permissions — signed-in access only.</p>;
  }
  return (
    <div className="admin-form-stack">
      <p className="admin-muted">
        {role.user_count} {role.user_count === 1 ? "user has" : "users have"} this role. Permissions are
        managed in code and applied with <code>manage.py sync_roles</code>.
      </p>
      {groupByApp(role.permissions).map(([app, perms]) => (
        <section key={app} className="admin-panel" aria-label={app}>
          <h3>{app}</h3>
          <ul className="perm-list">
            {perms.map((p) => (
              <li key={p}>
                <code>{p}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function RolesPage() {
  const query = useRoles();
  const [open, setOpen] = useState<RoleRow | undefined>(undefined);

  return (
    <>
      <SEOHead title="Roles" noindex />
      <h1>Roles</h1>
      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpen(r)}
        emptyLabel="No roles are seeded — run manage.py sync_roles."
      />
      <FormDrawer open={open !== undefined} title={open?.name ?? ""} onClose={() => setOpen(undefined)}>
        {open && <RoleDetail role={open} />}
      </FormDrawer>
    </>
  );
}
