/**
 * Row shapes for Administration → Users / Roles (docs/RBAC_DESIGN.md,
 * `apps.users.serializers.UserAdminSerializer`,
 * `apps.roles.serializers.RoleSerializer`). Roles are assigned to users
 * by group *name*; the role → permission map itself is code
 * (`manage.py sync_roles`), so roles are read-only here.
 */

export interface UserRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  is_staff: boolean;
  /** Role (auth.Group) names, sorted. */
  roles: string[];
  is_locked: boolean;
  last_login: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWrite {
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  roles: string[];
  /** Create only. Omit it and the server emails a set-password link. */
  password?: string;
}

export interface RoleRow {
  id: number;
  name: string;
  /** Effective codenames, e.g. `services.change_service`, sorted. */
  permissions: string[];
  user_count: number;
}
