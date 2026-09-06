/**
 * Mirrors the backend's response envelope (docs/API_DESIGN.md) so every
 * feature's API module gets the same success/error shape without
 * redefining it per call site.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fields: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
