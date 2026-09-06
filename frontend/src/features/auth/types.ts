/** `GET /api/v1/auth/session/` (docs/RBAC_DESIGN.md). */
export interface SessionUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  /** Role (auth.Group) names. */
  roles: string[];
  /** Effective permission codenames, e.g. `services.change_service`. */
  permissions: string[];
}
