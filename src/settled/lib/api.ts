/*
  A small client over fetch for the Settled API. Errors carry the API's own
  `message`, which is written to be shown to people as is. A 401 on a signed-in
  route sends the browser to /login and remembers where it was.
*/

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

type Body = Record<string, unknown> | unknown[] | string | Blob | File | null | undefined;

interface Opts {
  /** Public pages must not bounce to /login on a 401. */
  noRedirect?: boolean;
  signal?: AbortSignal;
  contentType?: string;
}

async function request<T>(method: string, path: string, body?: Body, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  let payload: BodyInit | undefined;
  if (body instanceof Blob) {
    payload = body;
    headers["content-type"] = opts.contentType || body.type || "text/csv";
  } else if (typeof body === "string") {
    payload = body;
    headers["content-type"] = opts.contentType || "text/plain";
  } else if (body !== undefined && body !== null) {
    payload = JSON.stringify(body);
    headers["content-type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: "same-origin", signal: opts.signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError("Could not reach Settled. Check your connection and try again.", 0, "network");
  }
  if (res.status === 401 && !opts.noRedirect && typeof window !== "undefined" && path.startsWith("/portal/invoicing/api/")) {
    const next = window.location.pathname + window.location.search;
    window.location.href = "/login?next=" + encodeURIComponent(next);
    throw new ApiError("Please sign in.", 401, "unauthenticated");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ApiError(e?.message || "Something went wrong. Please try again.", res.status, e?.code || "error");
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: Opts) => request<T>("GET", path, undefined, opts),
  post: <T>(path: string, body?: Body, opts?: Opts) => request<T>("POST", path, body ?? {}, opts),
  patch: <T>(path: string, body?: Body, opts?: Opts) => request<T>("PATCH", path, body ?? {}, opts),
  put: <T>(path: string, body?: Body, opts?: Opts) => request<T>("PUT", path, body ?? {}, opts),
  del: <T>(path: string, opts?: Opts) => request<T>("DELETE", path, undefined, opts),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

export function qs(params: Record<string, string | number | undefined | null | false>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== false && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? "?" + s : "";
}
