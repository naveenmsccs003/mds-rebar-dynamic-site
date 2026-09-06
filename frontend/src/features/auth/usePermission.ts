import { useSession } from "./hooks";

/**
 * UX-only permission check against the session's effective codenames
 * (docs/RBAC_DESIGN.md — "the frontend hiding a button is UX only"; the
 * backend re-checks every request). A superuser passes everything.
 * `perms` = one codename, or a list where **all** are required.
 */
export function usePermission(perms: string | string[]): boolean {
  const { data: session } = useSession();
  if (!session) return false;
  if (session.is_superuser) return true;
  const need = Array.isArray(perms) ? perms : [perms];
  const held = new Set(session.permissions);
  return need.every((p) => held.has(p));
}

/** Same, but returns a predicate for repeated checks in one render. */
export function usePermissionChecker(): (perms: string | string[]) => boolean {
  const { data: session } = useSession();
  return (perms) => {
    if (!session) return false;
    if (session.is_superuser) return true;
    const need = Array.isArray(perms) ? perms : [perms];
    const held = new Set(session.permissions);
    return need.every((p) => held.has(p));
  };
}
