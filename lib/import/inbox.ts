import "server-only"
import { get, run } from "../db"
import type { GarminActivity, TrackPoint } from "../garmin/client"
import { suggestPeaks } from "../garmin/peaks"
import { stashActivityTrack } from "../tracks"
import type { SourceId } from "./meta"

/** Add an activity from any source to the per-user inbox as 'pending'. Returns false when it is already there. */
export function addToInbox(userId: number, source: SourceId, a: GarminActivity, track: TrackPoint[]): boolean {
  if (get("SELECT 1 FROM garmin_activities WHERE user_id = ? AND activity_id = ?", userId, a.activityId)) return false
  const suggestions = suggestPeaks(a.name, track)
  const first = track[0]
  const last = track[track.length - 1]
  run(
    `INSERT INTO garmin_activities (user_id, activity_id, source, start_date, name, type, distance_mi, elevation_gain_ft, duration_min,
       start_lat, start_lon, end_lat, end_lon, raw_json, suggested_peaks_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    userId, a.activityId, source, a.startDate, a.name, a.type, a.distanceMi, a.elevationGainFt, a.durationMin,
    a.startLat ?? first?.lat ?? null, a.startLon ?? first?.lon ?? null, a.endLat ?? last?.lat ?? null, a.endLon ?? last?.lon ?? null,
    JSON.stringify(a.raw), JSON.stringify(suggestions)
  )
  stashActivityTrack(userId, a.activityId, track)
  return true
}

export function knownIds(userId: number): string[] {
  return (get<{ ids: string | null }>("SELECT group_concat(activity_id) ids FROM garmin_activities WHERE user_id = ?", userId)?.ids ?? "").split(",").filter(Boolean)
}

export function isKnown(userId: number, activityId: string): boolean {
  return !!get("SELECT 1 FROM garmin_activities WHERE user_id = ? AND activity_id = ?", userId, activityId)
}

export const sinceDate = (lastSyncAt: string | null, initialDays = 365) =>
  new Date(lastSyncAt ? Date.parse(lastSyncAt) - 3 * 86400_000 : Date.now() - initialDays * 86400_000).toISOString().slice(0, 10)
