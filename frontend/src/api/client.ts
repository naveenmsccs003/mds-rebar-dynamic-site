/**
 * Single axios instance every feature's API module builds on. Talks only
 * to the versioned backend API (docs/API_DESIGN.md) — never holds
 * secrets, never talks to a database directly (spec §57).
 *
 * `withCredentials: true` because staff/admin auth uses httpOnly session
 * cookies, not a bearer token in localStorage (docs/SECURITY.md — a token
 * readable by JS is a token readable by an XSS payload).
 */
import axios from "axios";

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Django's CSRF protection expects the token echoed back on unsafe
// methods (docs/SECURITY.md). The cookie is set by the backend once a
// session exists; this interceptor never invents or stores it itself.
apiClient.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) {
      config.headers["X-CSRFToken"] = csrfToken;
    }
  }
  return config;
});
