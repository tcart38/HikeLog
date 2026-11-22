import "server-only"
import { ZodError } from "zod"
import { authenticate, type User } from "./auth"
import { HikeError } from "./hikes"
import { MODES, type ListRow, type Mode } from "./progress"
import { findPerson } from "./people"

/** snake_case -> camelCase keys, recursively. Lets core libs keep SQL-shaped rows. */
export function camel<T = unknown>(v: unknown): T {
  if (Array.isArray(v)) return v.map((x) => camel(x)) as T
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) out[k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = camel(val)
    return out as T
  }
  return v as T
}

export function json(data: unknown, status = 200, init?: ResponseInit): Response {
  return Response.json(camel(data), { ...init, status })
}

export function error(message: string, status = 400, details?: unknown): Response {
  return Response.json(details === undefined ? { error: message } : { error: message, details: camel(details) }, { status })
}

/** Map any thrown value to a JSON error response. */
export function toErrorResponse(e: unknown): Response {
  if (e instanceof ZodError) {
    return error("Invalid request", 400, { issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code })) })
  }
  if (e instanceof HikeError) return error(e.message, e.status, e.details)
  if (e instanceof ApiError) return error(e.message, e.status, e.details)
  if (e instanceof SyntaxError) return error("Malformed JSON body", 400)
  console.error("API error:", e)
  return error("Internal server error", 500)
}

export class ApiError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) {
    super(message)
  }
}

export type RouteCtx<P> = { params: Promise<P> }
export type AuthedCtx<P> = { user: User; via: "token" | "session"; params: P }

type Handler<P> = (req: Request, ctx: AuthedCtx<P>) => Response | Promise<Response>

/** Public (unauthenticated) handler with error mapping. */
export function handle<P = Record<string, never>>(fn: (req: Request, params: P) => Response | Promise<Response>) {
  return async (req: Request, ctx?: RouteCtx<P>): Promise<Response> => {
    try {
      return await fn(req, ctx ? await ctx.params : ({} as P))
    } catch (e) {
      return toErrorResponse(e)
    }
  }
}

/** Authenticated handler: 401 JSON unless a valid Bearer token or same-origin session; optional admin guard. */
export function withAuth<P = Record<string, never>>(fn: Handler<P>, opts: { admin?: boolean } = {}) {
  return async (req: Request, ctx?: RouteCtx<P>): Promise<Response> => {
    try {
      const auth = await authenticate(req)
      if (!auth) {
        return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="hikelog"' } })
      }
      if (opts.admin && !auth.user.is_admin) return error("Admin only", 403)
      return await fn(req, { user: auth.user, via: auth.via, params: ctx ? await ctx.params : ({} as P) })
    } catch (e) {
      return toErrorResponse(e)
    }
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const body = await req.json()
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Body must be a JSON object")
  return body as T
}

export function intParam(v: string, what = "id"): number {
  if (!/^\d+$/.test(v)) throw new ApiError(`Invalid ${what}`, 400)
  return Number(v)
}

export function parseMode(v: string | null): Mode {
  if (!v) return "all"
  if (!MODES.includes(v as Mode)) throw new ApiError(`Invalid mode. One of: ${MODES.join(", ")}`, 400)
  return v as Mode
}

/** Person from an id or a name; throws 404 when unknown. */
export function requirePerson(ref: string): { id: number; name: string; color: string | null } {
  const p = findPerson(ref)
  if (!p) throw new ApiError(`Person not found: ${ref}`, 404)
  return p
}

/** Public base URL: forwarded headers, then APP_URL, then Host. No allow-list, works on any domain. */
export function baseUrl(req: Request): string {
  const h = req.headers
  const fwdHost = h.get("x-forwarded-host")?.split(",")[0]?.trim()
  if (fwdHost) {
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"
    return `${proto}://${fwdHost}`
  }
  if (process.env.APP_URL?.trim()) return process.env.APP_URL.trim().replace(/\/+$/, "")
  const host = h.get("host")
  if (host) return `${h.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(req.url).protocol.replace(":", "")}://${host}`
  return new URL(req.url).origin
}

export function intQuery(v: string | null, def?: number): number | undefined {
  if (v === null || v === "") return def
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0) throw new ApiError("Query numbers must be non-negative integers", 400)
  return n
}

/** List row with parsed sources and boolean isCustom. */
export function publicList(l: ListRow) {
  const { sources_json, is_custom, ...rest } = l
  let sources: unknown = []
  try {
    sources = JSON.parse(sources_json)
  } catch {}
  return { ...rest, is_custom: !!is_custom, sources }
}
