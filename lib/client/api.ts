/** Tiny same-origin fetch helper for client components. Cookie auth; throws ApiError on non-2xx. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message)
  }
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData } = {}
): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"), credentials: "same-origin" }
  if (opts.form) init.body = opts.form
  else if (opts.body !== undefined) {
    init.headers = { "Content-Type": "application/json" }
    init.body = JSON.stringify(opts.body)
  }
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0)
  }
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) ?? `Request failed (${res.status})`
    throw new ApiError(msg, res.status, data && typeof data === "object" ? (data as { details?: unknown }).details : undefined)
  }
  return data as T
}
