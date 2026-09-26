/**
 * Unified API Client for handling HTTP requests with consistent error handling,
 * typed JSON payloads, and cancellation support.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  if (!params) return path;
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  if (!queryString) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${queryString}`;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let payload: any = null;
  try {
    payload = isJson ? await res.json() : await res.text();
  } catch (err) {
    // Response body could not be parsed
  }

  if (!res.ok) {
    const errorMsg =
      (payload && typeof payload === "object" && (payload.error || payload.message)) ||
      (typeof payload === "string" && payload.trim().length > 0 ? payload : res.statusText) ||
      `HTTP Request failed with status ${res.status}`;
    throw new ApiError(res.status, errorMsg, payload);
  }

  return payload as T;
}

export const apiClient = {
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = buildUrl(path, options?.params);
    const res = await fetch(url, {
      method: "GET",
      signal: options?.signal,
      headers: {
        Accept: "application/json",
        ...(options?.headers || {}),
      },
    });
    return handleResponse<T>(res);
  },

  async post<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const url = buildUrl(path, options?.params);
    const res = await fetch(url, {
      method: "POST",
      signal: options?.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options?.headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async put<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    const url = buildUrl(path, options?.params);
    const res = await fetch(url, {
      method: "PUT",
      signal: options?.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options?.headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = buildUrl(path, options?.params);
    const res = await fetch(url, {
      method: "DELETE",
      signal: options?.signal,
      headers: {
        Accept: "application/json",
        ...(options?.headers || {}),
      },
    });
    return handleResponse<T>(res);
  },

  async upload<T>(path: string, formData: FormData, options?: RequestOptions & { method?: string }): Promise<T> {
    const url = buildUrl(path, options?.params);
    const res = await fetch(url, {
      method: options?.method || "POST",
      signal: options?.signal,
      headers: {
        Accept: "application/json",
        ...(options?.headers || {}),
      },
      body: formData,
    });
    return handleResponse<T>(res);
  },
};
