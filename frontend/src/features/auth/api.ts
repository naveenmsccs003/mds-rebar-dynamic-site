import { apiGet, apiPost } from "../../api/request";
import type { SessionUser } from "./types";

/** Prime the `csrftoken` cookie before the first state-changing call. */
export function getCsrf(): Promise<unknown> {
  return apiGet("/auth/csrf/");
}

export function getSession(): Promise<SessionUser> {
  return apiGet<SessionUser>("/auth/session/");
}

export async function login(email: string, password: string): Promise<SessionUser> {
  await getCsrf();
  return apiPost<SessionUser>("/auth/login/", { email, password });
}

export function logout(): Promise<unknown> {
  return apiPost("/auth/logout/");
}

export function changePassword(current_password: string, new_password: string): Promise<unknown> {
  return apiPost("/auth/password/change/", { current_password, new_password });
}
