/**
 * Thin wrapper over `apiClient` that unwraps the backend response
 * envelope (docs/API_DESIGN.md) so feature API modules work with plain
 * `T` and a single typed error, never the `{ success, data | error }`
 * shape at every call site.
 */
import { AxiosError } from "axios";

import { apiClient } from "./client";
import type { ApiError, ApiResponse } from "./envelope";

export class ApiRequestError extends Error {
  readonly code: string;
  readonly fields: Record<string, string[]>;
  readonly status: number | undefined;

  constructor(message: string, code: string, fields: Record<string, string[]>, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.fields = fields;
    this.status = status;
  }
}

function isEnvelope<T>(body: unknown): body is ApiResponse<T> {
  return typeof body === "object" && body !== null && "success" in body;
}

function toError(err: unknown): ApiRequestError {
  if (err instanceof AxiosError) {
    const body = err.response?.data as unknown;
    if (isEnvelope(body) && body.success === false) {
      const e = (body as ApiError).error;
      return new ApiRequestError(e.message, e.code, e.fields ?? {}, err.response?.status);
    }
    return new ApiRequestError(
      "The server could not be reached. Please try again.",
      "NETWORK_ERROR",
      {},
      err.response?.status,
    );
  }
  return new ApiRequestError("An unexpected error occurred.", "UNKNOWN", {});
}

async function unwrap<T>(promise: Promise<{ data: unknown }>): Promise<T> {
  try {
    const { data: body } = await promise;
    if (isEnvelope<T>(body)) {
      if (body.success) return body.data;
      throw new ApiRequestError(body.error.message, body.error.code, body.error.fields ?? {});
    }
    // A view that renders raw data still gets wrapped by the backend's
    // EnvelopeJSONRenderer, so this branch is a defensive fallback only.
    return body as T;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    throw toError(err);
  }
}

export function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return unwrap<T>(apiClient.get(url, { params }));
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return unwrap<T>(apiClient.post(url, body));
}

export function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return unwrap<T>(apiClient.patch(url, body));
}

export function apiDelete<T>(url: string): Promise<T> {
  return unwrap<T>(apiClient.delete(url));
}
