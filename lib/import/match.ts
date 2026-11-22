import "server-only"
import { all } from "../db"
import type { ActivityRow } from "../garmin/sync"

export type HikeMatch = {
  hikeId: number
  date: string
  endDate: string | null
  title: string | null
  peaks: { id: number; name: string }[]
  /** Peaks GPS/title suggested for the activity that the hike does not list yet. */
  newPeaks: { id: number; name: string }[]
  hasTrack: boolean
  distanceMi: number | null
  elevationGainFt: number | null
  durationMin: number | null
  score: number
  reasons: string[]
}

const PAD_DEG = 0.003 // ~300 m around a stored track's bounding box
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)
const close = (a: number | null, b: number | null, tol: number) => a != null && b != null && a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= tol

type Cand = {
  id: number; date: string; end_date: string | null; title: string | null
  distance_mi: number | null; elevation_gain_ft: number | null; duration_min: number | null
  min_lon: number | null; min_lat: number | null; max_lon: number | null; max_lat: number | null
}

/**
 * Hikes this user already logged that the activity probably is. Requires the user's own person on the hike, a date that
 * overlaps the activity day, and at least one more sign: shared peaks, a start point inside the hike's GPS track area,
 * or a similar distance/elevation/duration. Dates one day off (late starts, midnight) only count with peaks or location.
 * Never mutates anything: merging is the user's call.
 */
export function findMatches(user: { person_id: number | null }, act: ActivityRow): HikeMatch[] {
  const from = addDays(act.start_date, -1)
  const to = addDays(act.start_date, 1)
  const cands = all<Cand>(
    `SELECT h.id, h.date, h.end_date, h.title, h.distance_mi, h.elevation_gain_ft, h.duration_min, t.min_lon, t.min_lat, t.max_lon, t.max_lat
     FROM hikes h LEFT JOIN hike_tracks t ON t.hike_id = h.id
     WHERE h.date <= ? AND COALESCE(h.end_date, h.date) >= ?
       ${user.person_id ? "AND EXISTS (SELECT 1 FROM hike_participants x WHERE x.hike_id = h.id AND x.person_id = ?)" : ""}`,
    to, from, ...(user.person_id ? [user.person_id] : [])
  )
  if (!cands.length) return []
  const suggested = new Map(act.suggested_peaks.map((p) => [p.id, p.name]))
  const out: HikeMatch[] = []
  for (const c of cands) {
    const peaks = all<{ id: number; name: string }>("SELECT p.id, p.name FROM hike_peaks hp JOIN peaks p ON p.id = hp.peak_id WHERE hp.hike_id = ? ORDER BY hp.ordinal", c.id)
    const sameDay = c.date <= act.start_date && (c.end_date ?? c.date) >= act.start_date
    const shared = peaks.filter((p) => suggested.has(p.id))
    const inArea =
      c.min_lon != null && act.start_lat != null && act.start_lon != null &&
      act.start_lat >= c.min_lat! - PAD_DEG && act.start_lat <= c.max_lat! + PAD_DEG && act.start_lon >= c.min_lon - PAD_DEG && act.start_lon <= c.max_lon! + PAD_DEG
    const similar = [close(act.distance_mi, c.distance_mi, 0.25), close(act.elevation_gain_ft, c.elevation_gain_ft, 0.25), close(act.duration_min, c.duration_min, 0.3)].filter(Boolean).length
    const strong = shared.length > 0 || inArea
    if (!strong && !(sameDay && similar >= 1)) continue
    const reasons: string[] = []
    if (shared.length) reasons.push(`same peak${shared.length > 1 ? "s" : ""}: ${shared.map((p) => p.name).join(", ")}`)
    if (inArea) reasons.push("starts inside this hike's GPS track")
    if (similar) reasons.push("similar distance, climb or time")
    reasons.push(sameDay ? "same day" : "within a day")
    const have = new Set(peaks.map((p) => p.id))
    out.push({
      hikeId: c.id, date: c.date, endDate: c.end_date, title: c.title, peaks,
      newPeaks: [...suggested].filter(([id]) => !have.has(id)).map(([id, name]) => ({ id, name })),
      hasTrack: c.min_lon != null, distanceMi: c.distance_mi, elevationGainFt: c.elevation_gain_ft, durationMin: c.duration_min,
      score: shared.length * 4 + (inArea ? 3 : 0) + similar + (sameDay ? 2 : 0), reasons,
    })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3)
}
