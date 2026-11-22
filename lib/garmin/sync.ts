import "server-only"
import { all, get, run } from "../db"
import { ApiError } from "../api"
import { saveHike, type HikeInput } from "../hikes"
import { accessToken, exchangeKey, fetchTrack, getConnection, listActivities } from "./client"
import { INITIAL_SYNC_DAYS } from "./config"
import { encrypt } from "./crypto"
import { suggestPeaks, type PeakSuggestion } from "./peaks"

export type ActivityRow = {
  id: number
  user_id: number
  activity_id: string
  start_date: string
  name: string | null
  type: string | null
  distance_mi: number | null
  elevation_gain_ft: number | null
  duration_min: number | null
  start_lat: number | null
  start_lon: number | null
  end_lat: number | null
  end_lon: number | null
  status: "pending" | "imported" | "ignored"
  hike_id: number | null
  suggested_peaks: PeakSuggestion[]
}

const COLS =
  "id, user_id, activity_id, start_date, name, type, distance_mi, elevation_gain_ft, duration_min, start_lat, start_lon, end_lat, end_lon, status, hike_id, suggested_peaks_json"

function toRow(r: Record<string, unknown>): ActivityRow {
  const { suggested_peaks_json, ...rest } = r
  let suggested: PeakSuggestion[] = []
  try {
    suggested = JSON.parse(String(suggested_peaks_json ?? "[]"))
  } catch {}
  return { ...(rest as Omit<ActivityRow, "suggested_peaks">), suggested_peaks: suggested }
}

export function listGarminActivities(userId: number, status?: string): ActivityRow[] {
  const rows = status
    ? all<Record<string, unknown>>(`SELECT ${COLS} FROM garmin_activities WHERE user_id = ? AND status = ? ORDER BY start_date DESC, id DESC`, userId, status)
    : all<Record<string, unknown>>(`SELECT ${COLS} FROM garmin_activities WHERE user_id = ? ORDER BY start_date DESC, id DESC`, userId)
  return rows.map(toRow)
}

export function getGarminActivity(userId: number, id: number): ActivityRow | null {
  const r = get<Record<string, unknown>>(`SELECT ${COLS} FROM garmin_activities WHERE user_id = ? AND id = ?`, userId, id)
  return r ? toRow(r) : null
}

/** Public connection status; never includes the key or tokens. */
export function connectionStatus(userId: number) {
  const c = getConnection(userId)
  if (!c) return { connected: false as const }
  return {
    connected: true as const,
    keyExpiresAt: c.key_expires_at,
    lastSyncAt: c.last_sync_at,
    lastError: c.last_error,
    connectedAt: c.created_at,
    pendingCount: get<{ n: number }>("SELECT COUNT(*) n FROM garmin_activities WHERE user_id = ? AND status = 'pending'", userId)!.n,
  }
}

/** Validate the key via a token exchange, then store it encrypted. */
export async function connect(userId: number, apiKey: string, keyExpiresAt?: string | null) {
  const key = apiKey.trim()
  const t = await exchangeKey(key)
  run(
    `INSERT INTO garmin_connections (user_id, api_key_enc, key_expires_at, access_token_enc, access_token_expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET api_key_enc = excluded.api_key_enc, key_expires_at = excluded.key_expires_at,
       access_token_enc = excluded.access_token_enc, access_token_expires_at = excluded.access_token_expires_at, last_error = NULL`,
    userId, encrypt(key), keyExpiresAt ?? null, encrypt(t.accessToken), t.expiresAt.toISOString()
  )
}

export function disconnect(userId: number) {
  run("DELETE FROM garmin_connections WHERE user_id = ?", userId)
}

const syncing = new Set<number>()

export type SyncResult = { fetched: number; added: number; skipped: number; since: string }

/** Pull new hiking activities and store them as pending with peak suggestions. */
export async function syncUser(userId: number): Promise<SyncResult> {
  const conn = getConnection(userId)
  if (!conn) throw new ApiError("Garmin is not connected", 404)
  if (syncing.has(userId)) throw new ApiError("A sync is already running", 409)
  syncing.add(userId)
  try {
    // re-scan a few days before the last sync so late-uploaded activities are not missed
    const base = conn.last_sync_at
      ? new Date(Date.parse(conn.last_sync_at) - 3 * 86400_000)
      : new Date(Date.now() - INITIAL_SYNC_DAYS * 86400_000)
    const since = base.toISOString().slice(0, 10)
    try {
      await accessToken(userId)
      const acts = await listActivities(userId, since)
      let added = 0
      for (const a of acts) {
        if (get("SELECT 1 FROM garmin_activities WHERE user_id = ? AND activity_id = ?", userId, a.activityId)) continue
        const track = await fetchTrack(userId, a.activityId)
        const suggestions = suggestPeaks(a.name, track)
        // end points from the track when the summary lacks them
        const first = track[0]
        const last = track[track.length - 1]
        run(
          `INSERT INTO garmin_activities (user_id, activity_id, start_date, name, type, distance_mi, elevation_gain_ft, duration_min,
             start_lat, start_lon, end_lat, end_lon, raw_json, suggested_peaks_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          userId, a.activityId, a.startDate, a.name, a.type, a.distanceMi, a.elevationGainFt, a.durationMin,
          a.startLat ?? first?.lat ?? null, a.startLon ?? first?.lon ?? null, a.endLat ?? last?.lat ?? null, a.endLon ?? last?.lon ?? null,
          JSON.stringify(a.raw), JSON.stringify(suggestions)
        )
        added++
      }
      run("UPDATE garmin_connections SET last_sync_at = ?, last_error = NULL WHERE user_id = ?", new Date().toISOString(), userId)
      return { fetched: acts.length, added, skipped: acts.length - added, since }
    } catch (e) {
      run("UPDATE garmin_connections SET last_error = ? WHERE user_id = ?", e instanceof Error ? e.message : String(e), userId)
      throw e
    }
  } finally {
    syncing.delete(userId)
  }
}

export async function syncAllUsers(): Promise<void> {
  for (const c of all<{ user_id: number }>("SELECT user_id FROM garmin_connections")) {
    try {
      await syncUser(c.user_id)
    } catch (e) {
      console.error(`[garmin] sync failed for user ${c.user_id}:`, e instanceof Error ? e.message : e)
    }
  }
}

export type ImportOptions = {
  peaks?: (string | number)[]
  participants?: HikeInput["participants"]
  conditions?: HikeInput["conditions"]
  notes?: string | null
  weather?: string | null
}

export function importActivity(user: { id: number; person_id: number | null }, activityRowId: number, opts: ImportOptions = {}) {
  const act = getGarminActivity(user.id, activityRowId)
  if (!act) throw new ApiError("Activity not found", 404)
  const peaks = opts.peaks ?? act.suggested_peaks.map((p) => p.id)
  const participants = opts.participants ?? (user.person_id ? [user.person_id] : undefined)
  const input: HikeInput = {
    date: act.start_date,
    title: act.name,
    peaks,
    participants,
    conditions: opts.conditions ?? null,
    notes: opts.notes ?? null,
    weather: opts.weather ?? null,
    distanceMi: act.distance_mi,
    elevationGainFt: act.elevation_gain_ft,
    durationMin: act.duration_min,
    externalId: `garmin:${act.activity_id}`,
  }
  const res = saveHike(input, { userId: user.id, userPersonId: user.person_id, source: "api" })
  run("UPDATE garmin_activities SET status = 'imported', hike_id = ? WHERE id = ? AND user_id = ?", res.hike.id, act.id, user.id)
  return { hike: res.hike, peakMatches: res.peakMatches, activity: getGarminActivity(user.id, act.id)! }
}

export function ignoreActivity(userId: number, activityRowId: number) {
  const act = getGarminActivity(userId, activityRowId)
  if (!act) throw new ApiError("Activity not found", 404)
  run("UPDATE garmin_activities SET status = 'ignored' WHERE id = ? AND user_id = ?", act.id, userId)
  return getGarminActivity(userId, act.id)!
}
