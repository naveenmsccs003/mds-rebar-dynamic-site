import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiRequestError } from "../../api/request";
import { changePassword, getSession, login, logout } from "./api";
import type { SessionUser } from "./types";

export const SESSION_KEY = ["auth", "session"] as const;

/**
 * The current session, or `null` when not signed in (the API returns 401,
 * which `getSession` throws as an `ApiRequestError` with status 401).
 * `retry: false` so an anonymous visitor resolves immediately.
 */
export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        return await getSession();
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    onSuccess: (user) => qc.setQueryData(SESSION_KEY, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      qc.setQueryData(SESSION_KEY, null);
      qc.removeQueries({ queryKey: ["admin"] });
    },
  });
}

export function usePasswordChange() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      changePassword(current, next),
  });
}
