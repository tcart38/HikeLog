import "server-only"
import { ApiError } from "./api"

/**
 * Minimal Overpass API client. The public servers are shared and frequently at capacity, so this retries with
 * backoff, falls back across mirrors and sends a descriptive User-Agent (their usage policy asks for one).
 * Override with OVERPASS_URL (comma-separated endpoints) and OVERPASS_CONTACT (shown in the User-Agent).
 */
const DEFAULT_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

export const endpoints = () =>
  (process.env.OVERPASS_URL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .concat(process.env.OVERPASS_URL ? [] : DEFAULT_ENDPOINTS)

export const userAgent = () => `HikeLog/0.1 (self-hosted hike tracker; trail redlining${process.env.OVERPASS_CONTACT ? `; ${process.env.OVERPASS_CONTACT}` : ""})`

export class OverpassError extends ApiError {
  constructor(message: string, status = 502) {
    super(message, status)
  }
}

export type OverpassElement = {
  type: "way" | "relation" | "node"
  id: number
  tags?: Record<string, string>
  geometry?: { lat: number; lon: number }[]
  members?: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[]
}

/** A quick liveness probe: any HTTP answer (even "busy") means the host is up. */
async function reachable(endpoint: string): Promise<boolean> {
  try {
    await fetch(endpoint.replace(/interpreter\/?$/, "status"), { headers: { "User-Agent": userAgent() }, signal: AbortSignal.timeout(8_000) })
    return true
  } catch {
    return false
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Run an Overpass QL query. `timeoutMs` is per attempt (default 5 minutes). */
export async function overpass(query: string, opts: { timeoutMs?: number; attempts?: number; onAttempt?: (msg: string) => void } = {}): Promise<OverpassElement[]> {
  const eps = endpoints()
  const attempts = opts.attempts ?? 6
  let last = "no attempt made"
  for (let round = 0; round < attempts; round++) {
    for (const ep of eps) {
      try {
        // Skip fallback mirrors that do not answer at all (the primary is always tried: its status page can be slow when busy), so one dead host cannot eat the whole timeout.
        if (ep !== eps[0] && !(await reachable(ep))) {
          last = `${new URL(ep).host}: not reachable`
          continue
        }
        opts.onAttempt?.(`${new URL(ep).host} (try ${round + 1})`)
        const res = await fetch(ep, {
          method: "POST",
          headers: { "User-Agent": userAgent(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
        })
        const text = await res.text()
        if (res.ok && text.trimStart().startsWith("{")) {
          const data = JSON.parse(text) as { elements?: OverpassElement[]; remark?: string }
          if (data.remark && /error|timed out|out of memory/i.test(data.remark)) {
            last = `${new URL(ep).host}: ${data.remark}`
            continue
          }
          return data.elements ?? []
        }
        last = `${new URL(ep).host}: HTTP ${res.status}`
        if (res.status === 400) throw new OverpassError(`Overpass rejected the query: ${text.slice(0, 300)}`, 500)
      } catch (e) {
        if (e instanceof OverpassError) throw e
        last = `${new URL(ep).host}: ${e instanceof Error ? e.message : String(e)}`
      }
    }
    await sleep(Math.min(30_000, 4_000 * 2 ** round))
  }
  throw new OverpassError(`Overpass is busy or unreachable (${last}). Try again in a few minutes.`, 503)
}
