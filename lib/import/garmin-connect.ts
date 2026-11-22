import "server-only"
import { spawn } from "node:child_process"
import path from "node:path"
import { ApiError } from "../api"
import { parseActivity, parseGpx } from "../garmin/client"
import { ACTIVITY_TYPES } from "../garmin/config"
import { addToInbox, knownIds, sinceDate } from "./inbox"
import { connStatus, deleteConn, getConn, ImportError, markError, markSynced, readSecret, saveConn, updateSecret } from "./store"

/**
 * UNOFFICIAL Garmin Connect access through python-garminconnect (scripts/garmin_bridge.py).
 * Not endorsed by Garmin and may break whenever Garmin changes its login. See lib/import/meta.ts for the user-facing caveats.
 */
const PROVIDER = "garmin_connect" as const
const MAX_NEW_PER_SYNC = 25

type Reply = { status: "ok" | "needs_mfa" | "error"; tokens?: string; state?: unknown; kind?: string; message?: string; activities?: { raw: Record<string, unknown>; gpx: string | null }[]; more?: boolean }

function bridge(req: Record<string, unknown>, timeoutMs = 60_000): Promise<Reply> {
  const py = process.env.GARMIN_BRIDGE_PYTHON || "python3"
  const script = process.env.GARMIN_BRIDGE_SCRIPT || path.join(process.cwd(), "scripts", "garmin_bridge.py")
  return new Promise((resolve, reject) => {
    const child = spawn(py, ["-I", script], { stdio: ["pipe", "pipe", "pipe"] })
    let out = ""
    let err = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new ImportError("Garmin Connect did not answer in time. Try again in a few minutes."))
    }, timeoutMs)
    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("error", (e) => {
      clearTimeout(timer)
      reject(new ImportError(`Could not run the Garmin Connect helper (${e.message}). Python 3 with the garminconnect package must be installed.`, 501))
    })
    child.on("close", () => {
      clearTimeout(timer)
      try {
        resolve(JSON.parse(out) as Reply)
      } catch {
        reject(new ImportError(`The Garmin Connect helper failed: ${(err || out).trim().slice(-300) || "no output"}`))
      }
    })
    child.stdin.end(JSON.stringify(req))
  })
}

function raise(r: Reply): never {
  const msg = r.message || "Garmin Connect request failed"
  if (r.kind === "rate_limit")
    throw new ImportError("Garmin is rate limiting this login (HTTP 429). Wait 30 minutes or more before trying again. Repeated attempts extend the block.", 429)
  if (r.kind === "auth") throw new ImportError(`Garmin did not accept that sign-in: ${msg}`, 422)
  throw new ImportError(`Garmin Connect: ${msg}`)
}

export const garminConnectStatus = (userId: number) => connStatus(userId, PROVIDER)

export type LoginResult = { status: "connected" } | { status: "needs_mfa" }

export async function garminConnectLogin(userId: number, email: string, password: string): Promise<LoginResult> {
  const r = await bridge({ cmd: "login", email, password }, 90_000)
  if (r.status === "needs_mfa") {
    saveConn(userId, PROVIDER, "pending", { email, state: r.state }, { email })
    return { status: "needs_mfa" }
  }
  if (r.status !== "ok" || !r.tokens) raise(r)
  saveConn(userId, PROVIDER, "connected", { email, tokens: r.tokens }, { email })
  return { status: "connected" }
}

export async function garminConnectMfa(userId: number, code: string): Promise<LoginResult> {
  const c = getConn(userId, PROVIDER)
  if (!c || c.status !== "pending") throw new ApiError("No Garmin sign-in is waiting for a code. Start again with your email and password.", 409)
  const s = readSecret<{ email: string; state: unknown }>(c)
  const r = await bridge({ cmd: "mfa", state: s.state, code }, 90_000)
  if (r.status !== "ok" || !r.tokens) {
    if (r.kind === "auth") throw new ImportError("That code was not accepted. Codes expire quickly: request a new one by signing in again.", 422)
    raise(r)
  }
  saveConn(userId, PROVIDER, "connected", { email: s.email, tokens: r.tokens }, { email: s.email })
  return { status: "connected" }
}

export const garminConnectDisconnect = (userId: number) => deleteConn(userId, PROVIDER)

const syncing = new Set<number>()

export async function garminConnectSync(userId: number) {
  const c = getConn(userId, PROVIDER)
  if (!c || c.status !== "connected") throw new ApiError("Garmin Connect is not connected", 404)
  if (syncing.has(userId)) throw new ApiError("A sync is already running", 409)
  syncing.add(userId)
  try {
    const secret = readSecret<{ email: string; tokens: string }>(c)
    const since = sinceDate(c.last_sync_at)
    const r = await bridge({ cmd: "sync", tokens: secret.tokens, since, types: [...ACTIVITY_TYPES], skip: knownIds(userId), max_new: MAX_NEW_PER_SYNC }, 300_000)
    if (r.status !== "ok") {
      if (r.kind === "auth") throw new ImportError("Garmin no longer accepts the saved session. Sign in again below.", 401)
      raise(r)
    }
    if (r.tokens && r.tokens !== secret.tokens) updateSecret(userId, PROVIDER, { ...secret, tokens: r.tokens })
    let added = 0
    for (const item of r.activities ?? []) {
      const a = parseActivity(item.raw)
      if (!a || !ACTIVITY_TYPES.has(a.type ?? "")) continue
      if (addToInbox(userId, PROVIDER, a, item.gpx ? parseGpx(item.gpx) : [])) added++
    }
    // When capped, leave last_sync_at alone so the next Sync continues from the same window.
    if (!r.more) markSynced(userId, PROVIDER)
    return { fetched: r.activities?.length ?? 0, added, since, more: !!r.more }
  } catch (e) {
    markError(userId, PROVIDER, e instanceof Error ? e.message : String(e))
    throw e
  } finally {
    syncing.delete(userId)
  }
}
