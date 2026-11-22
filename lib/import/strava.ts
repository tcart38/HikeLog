import "server-only"
import { ApiError } from "../api"
import { decrypt, encrypt } from "../garmin/crypto"
import type { GarminActivity, TrackPoint } from "../garmin/client"
import { addToInbox, isKnown, sinceDate } from "./inbox"
import { connStatus, deleteConn, getConn, ImportError, markError, markSynced, readSecret, saveConn, updateSecret } from "./store"

/** Strava's official API (v3). Each person registers their own free API app at https://www.strava.com/settings/api. */
const PROVIDER = "strava" as const
const AUTH_URL = "https://www.strava.com/oauth/authorize"
const TOKEN_URL = "https://www.strava.com/oauth/token"
const API = "https://www.strava.com/api/v3"
const TYPES = new Set(["hike", "walk", "snowshoe"])
const MAX_NEW_PER_SYNC = 30
export const STRAVA_SETTINGS_URL = "https://www.strava.com/settings/api"

type Secret = { clientId: string; clientSecret: string; accessToken?: string; refreshToken?: string; expiresAt?: number }

const M_TO_MI = 0.000621371
const M_TO_FT = 3.28084

export const stravaStatus = (userId: number) => connStatus(userId, PROVIDER)

/** Save the user's own Strava app credentials. They must authorise again afterwards. */
export function stravaSaveApp(userId: number, clientId: string, clientSecret: string) {
  saveConn(userId, PROVIDER, "pending", { clientId: clientId.trim(), clientSecret: clientSecret.trim() } satisfies Secret, {})
}

export const stravaDisconnect = (userId: number) => deleteConn(userId, PROVIDER)

function secretOf(userId: number): Secret {
  const c = getConn(userId, PROVIDER)
  if (!c) throw new ApiError("Save your Strava app's Client ID and Secret first", 404)
  return readSecret<Secret>(c)
}

/** Signed, expiring OAuth `state` (AES-GCM) that ties the callback to the user who started it. */
function makeState(userId: number): string {
  return encrypt(JSON.stringify({ u: userId, exp: Date.now() + 15 * 60_000 }))
}

function checkState(state: string | null, userId: number) {
  try {
    const s = JSON.parse(decrypt(state ?? "")) as { u: number; exp: number }
    if (s.u === userId && s.exp > Date.now()) return
  } catch {}
  throw new ApiError("That Strava sign-in link expired or belongs to another account. Start again from Settings.", 400)
}

/** Authorise URL for a given redirect target. `redirectUri` must be on the Authorization Callback Domain set in the Strava app. */
export function stravaAuthorizeUrl(userId: number, redirectUri: string): string {
  const s = secretOf(userId)
  const q = new URLSearchParams({
    client_id: s.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state: makeState(userId),
  })
  return `${AUTH_URL}?${q}`
}

async function tokenRequest(body: Record<string, string>) {
  let res: Response
  try {
    res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), signal: AbortSignal.timeout(30_000) })
  } catch (e) {
    throw new ImportError(`Could not reach Strava: ${e instanceof Error ? e.message : String(e)}`)
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 400 || res.status === 401) throw new ImportError("Strava rejected the Client ID/Secret or the authorisation code (codes work once and expire fast). Check them and authorise again.", 422)
  if (res.status === 429) throw new ImportError("Strava is rate limiting this app. Wait 15 minutes and try again.", 429)
  if (!res.ok) throw new ImportError(`Strava token request failed (HTTP ${res.status})`)
  return data
}

/** Finish OAuth: the `code` came from the callback or was pasted from the redirect URL. */
export async function stravaExchange(userId: number, codeOrUrl: string, state?: string | null) {
  let code = codeOrUrl.trim()
  let st = state ?? null
  if (/^https?:\/\//i.test(code) || code.includes("code=")) {
    const u = new URL(code.includes("://") ? code : `http://x/?${code.replace(/^\?/, "")}`)
    if (u.searchParams.get("error")) throw new ApiError("You declined access on Strava.", 400)
    code = u.searchParams.get("code") ?? ""
    st = u.searchParams.get("state") ?? st
  }
  if (!code) throw new ApiError("No authorisation code found. Paste the full address Strava sent you to.", 400)
  checkState(st, userId)
  const s = secretOf(userId)
  const d = await tokenRequest({ client_id: s.clientId, client_secret: s.clientSecret, code, grant_type: "authorization_code" })
  const athlete = d.athlete as { firstname?: string; lastname?: string; username?: string } | undefined
  const name = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(" ") || athlete?.username || null
  saveConn(userId, PROVIDER, "connected", { ...s, accessToken: String(d.access_token), refreshToken: String(d.refresh_token), expiresAt: Number(d.expires_at) } satisfies Secret, { athlete: name })
}

async function accessToken(userId: number): Promise<string> {
  const s = secretOf(userId)
  if (!s.refreshToken) throw new ApiError("Strava is not authorised yet", 409)
  if (s.accessToken && (s.expiresAt ?? 0) * 1000 - Date.now() > 60_000) return s.accessToken
  const d = await tokenRequest({ client_id: s.clientId, client_secret: s.clientSecret, grant_type: "refresh_token", refresh_token: s.refreshToken })
  updateSecret(userId, PROVIDER, { ...s, accessToken: String(d.access_token), refreshToken: String(d.refresh_token ?? s.refreshToken), expiresAt: Number(d.expires_at) })
  return String(d.access_token)
}

async function get(userId: number, pathAndQuery: string): Promise<Response> {
  const token = await accessToken(userId)
  let res: Response
  try {
    res = await fetch(`${API}${pathAndQuery}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) })
  } catch (e) {
    throw new ImportError(`Could not reach Strava: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (res.status === 401) throw new ImportError("Strava no longer accepts this authorisation. Authorise again below.", 401)
  return res
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

export function parseStravaActivity(a: Record<string, unknown>): GarminActivity | null {
  const type = String(a.sport_type ?? a.type ?? "").toLowerCase()
  const start = String(a.start_date_local ?? "")
  if (a.id == null || !/^\d{4}-\d{2}-\d{2}/.test(start) || !TYPES.has(type)) return null
  const ll = (v: unknown) => (Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number" ? (v as [number, number]) : null)
  const s = ll(a.start_latlng)
  const e = ll(a.end_latlng)
  const dist = num(a.distance)
  const gain = num(a.total_elevation_gain)
  const dur = num(a.moving_time) ?? num(a.elapsed_time)
  return {
    activityId: `strava:${a.id}`,
    name: typeof a.name === "string" ? a.name : null,
    type: type === "hike" ? "hiking" : type,
    startDate: start.slice(0, 10),
    distanceMi: dist == null ? null : Math.round(dist * M_TO_MI * 100) / 100,
    elevationGainFt: gain == null ? null : Math.round(gain * M_TO_FT),
    durationMin: dur == null ? null : Math.round(dur / 60),
    startLat: s?.[0] ?? null,
    startLon: s?.[1] ?? null,
    endLat: e?.[0] ?? null,
    endLon: e?.[1] ?? null,
    raw: a,
  }
}

async function fetchStream(userId: number, id: string): Promise<TrackPoint[]> {
  const res = await get(userId, `/activities/${id}/streams?keys=latlng,altitude&key_by_type=true`)
  if (res.status === 429) throw new ImportError("Strava rate limit reached", 429)
  if (!res.ok) return []
  const d = (await res.json().catch(() => ({}))) as { latlng?: { data?: [number, number][] }; altitude?: { data?: number[] } }
  const ll = d.latlng?.data ?? []
  const alt = d.altitude?.data ?? []
  return ll.map(([lat, lon], i) => ({ lat, lon, eleM: typeof alt[i] === "number" ? alt[i] : null }))
}

const syncing = new Set<number>()

export async function stravaSync(userId: number) {
  const c = getConn(userId, PROVIDER)
  if (!c || c.status !== "connected") throw new ApiError("Strava is not connected", 404)
  if (syncing.has(userId)) throw new ApiError("A sync is already running", 409)
  syncing.add(userId)
  let added = 0
  let fetched = 0
  let more = false
  const since = sinceDate(c.last_sync_at)
  try {
    const after = Math.floor(Date.parse(`${since}T00:00:00Z`) / 1000)
    outer: for (let page = 1; page <= 20; page++) {
      const res = await get(userId, `/athlete/activities?after=${after}&per_page=100&page=${page}`)
      if (res.status === 429) throw new ImportError("Strava rate limit reached (100 requests per 15 minutes). Sync again in about 15 minutes to continue.", 429)
      if (!res.ok) throw new ImportError(`Strava activity list failed (HTTP ${res.status})`)
      const items = (await res.json()) as Record<string, unknown>[]
      for (const it of items) {
        const a = parseStravaActivity(it)
        if (!a) continue
        fetched++
        if (isKnown(userId, a.activityId)) continue
        if (added >= MAX_NEW_PER_SYNC) {
          more = true
          break outer
        }
        let track: TrackPoint[] = []
        try {
          track = await fetchStream(userId, a.activityId.slice("strava:".length))
        } catch (e) {
          if (e instanceof ImportError && e.status === 429) {
            more = true
            break outer
          }
          throw e
        }
        if (addToInbox(userId, PROVIDER, a, track)) added++
      }
      if (items.length < 100) break
    }
    if (!more) markSynced(userId, PROVIDER)
    return { fetched, added, since, more }
  } catch (e) {
    markError(userId, PROVIDER, e instanceof Error ? e.message : String(e))
    throw e
  } finally {
    syncing.delete(userId)
  }
}
