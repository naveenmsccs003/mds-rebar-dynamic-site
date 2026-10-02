/**
 * Query/mutation hooks for Administration → Users / Roles. Users have no
 * delete (`users.delete_user` is denied even to Admin) — an account is
 * retired by PATCHing `is_active: false`. Roles are a read-only list of
 * the ten seeded groups; it fits in one page, so it is fetched whole.
 */
import { useQuery } from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import { adminList } from "../admin-shared/crud";
import { makeCrudHooks } from "../admin-shared/hooks";
import type { RoleRow, UserRow, UserWrite } from "./types";

const crud = makeCrudHooks<UserRow, UserWrite>("users", "/admin/users/");

export const users = { useList: crud.useList, useCreate: crud.useCreate, useUpdate: crud.useUpdate };

export function useRoles() {
  return useQuery<Paginated<RoleRow>>({
    queryKey: ["admin", "roles", "list"],
    queryFn: () => adminList<RoleRow>("/admin/roles/"),
    staleTime: 5 * 60 * 1000,
  });
}
