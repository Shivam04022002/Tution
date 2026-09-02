import { API_URL } from '../config/env';

/**
 * Single HTTP entry point for the console. Every request in `src/api/*` goes
 * through here so the auth header, the backend's `{ success, message }` envelope
 * and the status-code handling live in exactly one place.
 */

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];
  /** Raw parsed body, when the server returned JSON. */
  readonly body: unknown;

  constructor(status: number, message: string, fieldErrors: FieldError[] = [], body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.body = body;
  }

  /** True for transport-level failures (offline, DNS, CORS, aborted). */
  get isNetworkError() {
    return this.status === 0;
  }

  /** True when retrying the same request could plausibly succeed. */
  get isRetryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** Human copy for the status codes the backend actually returns. */
function defaultMessageFor(status: number): string {
  switch (status) {
    case 0:
      return 'Could not reach the server. Check your connection and try again.';
    case 400:
      return 'The request was rejected. Please review the highlighted fields.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'That resource no longer exists.';
    case 409:
      return 'This conflicts with existing data.';
    case 413:
      return 'The file is larger than the server accepts.';
    case 422:
      return 'Some values did not pass validation.';
    case 429:
      return 'Too many requests. Wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'The server ran into a problem. Please try again.';
    default:
      return `Request failed (${status}).`;
  }
}

/** express-validator returns `errors: [{ path | param, msg }]`. */
function extractFieldErrors(body: any): FieldError[] {
  if (!body || !Array.isArray(body.errors)) return [];
  return body.errors
    .map((e: any) => ({
      field: String(e?.path ?? e?.param ?? ''),
      message: String(e?.msg ?? e?.message ?? ''),
    }))
    .filter((e: FieldError) => e.field && e.message);
}

// ── Session wiring ─────────────────────────────────────────────────────────
// The auth provider owns the token; the client only reads it through these
// hooks so no module has to import React state.

let tokenGetter: () => string | null = () => null;
let unauthorizedHandler: () => void = () => {};

export function configureClient(opts: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}) {
  tokenGetter = opts.getToken;
  unauthorizedHandler = opts.onUnauthorized;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip the automatic sign-out on 401 (used by the login call itself). */
  anonymous?: boolean;
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null> = {}
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function parseBody(response: Response): Promise<any> {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    const text = await response.text().catch(() => '');
    return text ? { message: text.slice(0, 300) } : null;
  }
  return response.json().catch(() => null);
}

/**
 * Performs a request and unwraps the backend envelope.
 *
 * The API is not uniform: most endpoints answer `{ success, data }` while a few
 * (auth, some admin lists) put fields at the top level. `request` therefore
 * returns the *whole* parsed body and each `src/api` module picks what it needs.
 */
export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, anonymous = false } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = tokenGetter();
  if (token && !anonymous) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(0, defaultMessageFor(0));
  }

  const parsed = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401 && !anonymous) unauthorizedHandler();
    const message = parsed?.message || defaultMessageFor(response.status);
    throw new ApiError(response.status, message, extractFieldErrors(parsed), parsed);
  }

  return parsed as T;
}

/** Convenience wrapper for the common `{ success, data }` envelope. */
export async function requestData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const body = await request<{ data: T }>(path, options);
  return body.data;
}

// ── Multipart upload with progress ─────────────────────────────────────────

export interface UploadOptions {
  /** Form field name the backend's multer instance expects. */
  fieldName: string;
  file: File;
  onProgress?: (percent: number) => void;
}

export interface UploadHandle<T> {
  promise: Promise<T>;
  abort: () => void;
}

/**
 * XHR-based upload — `fetch` cannot report request progress, and video uploads
 * are large enough that a progress bar is not optional.
 */
export function upload<T = any>(path: string, options: UploadOptions): UploadHandle<T> {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<T>((resolve, reject) => {
    const form = new FormData();
    form.append(options.fieldName, options.file);

    xhr.open('POST', `${API_URL}${path}`);
    xhr.setRequestHeader('Accept', 'application/json');

    const token = tokenGetter();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let parsed: any = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        parsed = xhr.responseText ? { message: xhr.responseText.slice(0, 300) } : null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as T);
        return;
      }

      if (xhr.status === 401) unauthorizedHandler();
      reject(
        new ApiError(
          xhr.status,
          parsed?.message || defaultMessageFor(xhr.status),
          extractFieldErrors(parsed),
          parsed
        )
      );
    };

    xhr.onerror = () => reject(new ApiError(0, defaultMessageFor(0)));
    xhr.ontimeout = () => reject(new ApiError(0, 'The upload timed out. Please try again.'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled.'));

    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}

/** Upload used for the Excel importer, which posts to a non-video endpoint. */
export function uploadFile<T = any>(
  path: string,
  fieldName: string,
  file: File
): Promise<T> {
  return upload<T>(path, { fieldName, file }).promise;
}
