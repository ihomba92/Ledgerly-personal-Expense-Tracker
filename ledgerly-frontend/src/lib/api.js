// Talking to the Ledgerly API.
// Set VITE_API_URL in a .env file at the project root if the API isn't at http://localhost:8000.
import { logger } from "@/lib/logger";

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const TOKEN_KEY = "ledgerly:token";

export const session = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  save(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage blocked: the user stays logged in until the tab closes */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

// Called when the API says the login has ended (401), so the app can return to the login page.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

/**
 * Errors from the API keep its message, per-field errors, reason (e.g. "insufficient_balance"),
 * details and the request id. For server errors the id is added to the message as a reference
 * the user can quote; it matches the line in the API's log.
 */
export class ApiError extends Error {
  constructor(status, body, requestId = null) {
    const id = body?.error?.request_id ?? requestId;
    let message = body?.error?.message ?? "Something went wrong. Please try again.";
    if (status >= 500 && id) message += ` (Reference: ${id})`;
    super(message);
    this.status = status;
    this.fields = body?.error?.fields ?? {};
    this.reason = body?.error?.reason ?? null;
    this.details = body?.error?.details ?? {};
    this.requestId = id;
  }
}

function query(params) {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * api("/expenses", { method: "POST", body: {...} })
 * - sends the login token unless auth: false
 * - `form` sends a FormData (file uploads) instead of JSON
 * - `raw` returns the Response (file downloads)
 */
export async function api(path, { method = "GET", body, form, params, auth = true, raw = false } = {}) {
  const headers = {};
  if (!form) headers["Content-Type"] = "application/json";
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

  let response;
  const started = performance.now();
  try {
    response = await fetch(`${API_URL}/api${path}${query(params)}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    logger.error(`${method} ${path} could not reach the API at ${API_URL}`, err);
    throw new ApiError(0, { error: { message: "Can’t reach Ledgerly right now. Check your connection and try again." } });
  }
  const requestId = response.headers.get("X-Request-ID");
  const ms = Math.round(performance.now() - started);
  const line = `${method} ${path} → ${response.status} (${ms} ms, request ${requestId ?? "?"})`;
  if (response.ok) logger.debug(line);

  if (response.status === 401 && auth && session.token) {
    session.clear();
    onUnauthorized();
  }
  if (raw && response.ok) return response;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new ApiError(response.status, data, requestId);
    (response.status >= 500 ? logger.error : logger.warn)(`${line}: ${error.message}`, error.fields);
    throw error;
  }
  return data;
}

/** Fetch every page of a paged list, e.g. all expenses. */
export async function apiAll(path, key, params = {}) {
  const items = [];
  for (let page = 1; ; page++) {
    const data = await api(path, { params: { ...params, page, per_page: 100 } });
    items.push(...data[key]);
    if (page >= data.pagination.pages) return items;
  }
}
