import "server-only"
import { get, run } from "../db"
import { ApiError } from "../api"
import { decrypt, encrypt } from "./crypto"
import { ACTIVITY_TYPES, API_BASE, PATHS, TOKEN_URL } from "./config"

export type TrackPoint = { lat: number; lon: number; eleM: number | null }

export type GarminActivity = {
  activityId: string
  name: string | null
  type: string | null
  startDate: string // YYYY-MM-DD, local
  distanceMi: number | null
  elevationGainFt: number | null
  durationMin: number | null
  startLat: number | null
  startLon: number | null
  endLat: number | null
  endLon: number | null
  raw: unknown
}

const M_TO_MI = 0.000621371
const M_TO_FT = 3.28084

export class GarminError extends Error {
  constructor(message: string, public status = 502) {
    super(message)
  }
}

async function http(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
  } catch (e) {
    throw new GarminError(`Could not reach Garmin: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Seconds-since-epoch `exp` from a JWT, if the token is one. */
function jwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { exp?: number }
    return typeof payload.exp === "number" ? payload.exp : null
  } catch {
    return null
  }
}

/** Exchange a personal API key for an OAuth2 access token. */
export async function exchangeKey(apiKey: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await http(TOKEN_URL, { method: "POST", headers: { Authorization: `ApiKey ${apiKey}`, Accept: "application/json" } })
  if (res.status === 401 || res.status === 403) throw new GarminError("Garmin rejected this API key. It may be wrong, deleted, or expired.", 400)
  if (!res.ok) throw new GarminError(`Garmin token exchange failed (HTTP ${res.status})`)
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    // some services return the bare token
    if (text.trim()) data = { access_token: text.trim() }
  }
  const token = String(data.access_token ?? data.accessToken ?? data.token ?? "")
  if (!token) throw new GarminError("Garmin token response had no access token")
  let expMs: number | null = null
  const exin = Number(data.expires_in ?? data.expiresIn)
  const exat = Number(data.expires_at ?? data.expiresAt)
  if (exin > 0) expMs = Date.now() + exin * 1000
  else if (exat > 0) expMs = (exat < 1e12 ? exat * 1000 : exat)
  else {
    const j = jwtExp(token)
    expMs = j ? j * 1000 : Date.now() + 24 * 3600_000
  }
  return { accessToken: token, expiresAt: new Date(expMs) }
}

type ConnRow = {
  id: number
  user_id: number
  api_key_enc: string
  key_expires_at: string | null
  access_token_enc: string | null
  access_token_expires_at: string | null
  last_sync_at: string | null
  last_error: string | null
  created_at: string
}

export function getConnection(userId: number): ConnRow | undefined {
  return get<ConnRow>("SELECT * FROM garmin_connections WHERE user_id = ?", userId)
}

/** Cached access token (refreshed when < 5 min left). */
export async function accessToken(userId: number, force = false): Promise<string> {
  const c = getConnection(userId)
  if (!c) throw new ApiError("Garmin is not connected", 404)
  if (!force && c.access_token_enc && c.access_token_expires_at && Date.parse(c.access_token_expires_at) - Date.now() > 5 * 60_000) {
    try {
      return decrypt(c.access_token_enc)
    } catch {}
  }
  const t = await exchangeKey(decrypt(c.api_key_enc))
  run("UPDATE garmin_connections SET access_token_enc = ?, access_token_expires_at = ? WHERE user_id = ?", encrypt(t.accessToken), t.expiresAt.toISOString(), userId)
  return t.accessToken
}

async function authedGet(userId: number, url: string, accept = "application/json"): Promise<Response> {
  let token = await accessToken(userId)
  let res = await http(url, { headers: { Authorization: `Bearer ${token}`, Accept: accept } })
  if (res.status === 401) {
    token = await accessToken(userId, true)
    res = await http(url, { headers: { Authorization: `Bearer ${token}`, Accept: accept } })
  }
  return res
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

export function parseActivity(a: Record<string, unknown>): GarminActivity | null {
  const id = a.activityId ?? a.id
  const startLocal = String(a.startTimeLocal ?? a.startTimeGMT ?? "")
  if (id == null || !/^\d{4}-\d{2}-\d{2}/.test(startLocal)) return null
  const typeObj = a.activityType as { typeKey?: string } | string | undefined
  const type = (typeof typeObj === "string" ? typeObj : typeObj?.typeKey ?? null)?.toLowerCase() ?? null
  const dist = num(a.distance)
  const gain = num(a.elevationGain)
  const dur = num(a.duration)
  return {
    activityId: String(id),
    name: typeof a.activityName === "string" ? a.activityName : null,
    type,
    startDate: startLocal.slice(0, 10),
    distanceMi: dist == null ? null : Math.round(dist * M_TO_MI * 100) / 100,
    elevationGainFt: gain == null ? null : Math.round(gain * M_TO_FT),
    durationMin: dur == null ? null : Math.round(dur / 60),
    startLat: num(a.startLatitude),
    startLon: num(a.startLongitude),
    endLat: num(a.endLatitude),
    endLon: num(a.endLongitude),
    raw: a,
  }
}

/** List activities on/after `since` (YYYY-MM-DD), paginated, filtered to hiking-like types. */
export async function listActivities(userId: number, since: string): Promise<GarminActivity[]> {
  const out: GarminActivity[] = []
  const limit = 100
  const today = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
  for (let start = 0; start < 5000; start += limit) {
    const qs = new URLSearchParams({ start: String(start), limit: String(limit), startDate: since, endDate: today })
    const res = await authedGet(userId, `${API_BASE}${PATHS.activities}?${qs}`)
    if (!res.ok) throw new GarminError(`Garmin activity list failed (HTTP ${res.status})`)
    const data = (await res.json()) as unknown
    const items = (Array.isArray(data) ? data : ((data as { activities?: unknown[] })?.activities ?? [])) as Record<string, unknown>[]
    for (const it of items) {
      const a = parseActivity(it)
      if (a && a.startDate >= since && a.type && ACTIVITY_TYPES.has(a.type)) out.push(a)
    }
    if (items.length < limit) break
  }
  return out
}

/** Minimal GPX parser: <trkpt lat lon><ele>. */
export function parseGpx(xml: string): TrackPoint[] {
  const pts: TrackPoint[] = []
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const lat = /lat="(-?[\d.]+)"/.exec(m[1])
    const lon = /lon="(-?[\d.]+)"/.exec(m[1])
    if (!lat || !lon) continue
    const ele = /<ele>(-?[\d.]+)<\/ele>/.exec(m[2])
    pts.push({ lat: Number(lat[1]), lon: Number(lon[1]), eleM: ele ? Number(ele[1]) : null })
  }
  return pts
}

/** GPS track via the GPX endpoint. Returns [] when unavailable (suggestions then fall back to the title). */
export async function fetchTrack(userId: number, activityId: string): Promise<TrackPoint[]> {
  try {
    const res = await authedGet(userId, `${API_BASE}${PATHS.gpx.replace("{id}", encodeURIComponent(activityId))}`, "application/gpx+xml, application/xml, */*")
    if (!res.ok) return []
    return parseGpx(await res.text())
  } catch {
    return []
  }
}
