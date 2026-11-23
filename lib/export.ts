import "server-only"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { all, db } from "./db"
import { listHikes, type Hike } from "./hikes"
import { listMedia, publicMedia } from "./media"
import { getWeather } from "./weather"

export function allHikes(): Hike[] {
  const out: Hike[] = []
  for (let offset = 0; ; offset += 1000) {
    const { hikes } = listHikes({ limit: 1000, offset })
    out.push(...hikes)
    if (hikes.length < 1000) break
  }
  return out
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v)
  // Neutralise spreadsheet formulas in free text, then quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
const csv = (header: string[], rows: unknown[][]) => [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n") + "\r\n"

export function hikesCsv(): string {
  const media = new Map<number, { image: number; video: number }>()
  for (const r of all<{ hike_id: number; kind: "image" | "video"; n: number }>("SELECT hike_id, kind, COUNT(*) n FROM hike_media GROUP BY hike_id, kind")) {
    const m = media.get(r.hike_id) ?? { image: 0, video: 0 }
    m[r.kind] = r.n
    media.set(r.hike_id, m)
  }
  return csv(
    ["id", "date", "end_date", "title", "peaks", "unmatched_peaks", "participants", "season", "counts_for_winter", "conditions", "distance_mi", "elevation_gain_ft", "duration_min", "route_type", "weather", "trail_conditions", "notes", "photos", "videos", "source"],
    allHikes().map((h) => [
      h.id, h.date, h.endDate, h.title,
      h.peaks.map((p) => p.name).join("; "), h.unmatchedPeaks.join("; "),
      h.participants.map((p) => (p.counts ? p.name : `${p.name} (not counted)`)).join("; "),
      h.season, h.isWinter ? "yes" : "no", h.conditions, h.distanceMi, h.elevationGainFt, h.durationMin, h.routeType,
      h.weather, h.trailConditions, h.notes, media.get(h.id)?.image ?? 0, media.get(h.id)?.video ?? 0, h.source,
    ])
  )
}

/** One row per person per peak per hike: the shape most spreadsheets want for pivoting. */
export function ascentsCsv(): string {
  const rows: unknown[][] = []
  for (const h of allHikes())
    for (const p of h.participants)
      for (const pk of h.peaks)
        rows.push([p.name, p.counts ? "yes" : "no", h.date, h.endDate, pk.name, pk.state, pk.elevationFt, h.season, h.isWinter ? "yes" : "no", h.conditions, h.id])
  return csv(["person", "counted", "date", "end_date", "peak", "state", "elevation_ft", "season", "winter_ascent", "conditions", "hike_id"], rows)
}

/** Everything in one JSON document: people, hikes (peaks, participants, weather, photo/video list), GPS tracks and custom lists. */
export function fullExport() {
  const hikes = allHikes().map((h) => ({
    ...h,
    weatherImported: getWeather(h.id),
    media: listMedia(h.id).map(publicMedia),
  }))
  return {
    app: "HikeLog",
    format: 1,
    exportedAt: new Date().toISOString(),
    note: "Photos and videos are not inlined. Their files live in the data volume under media/, and each hike lists them with their URLs.",
    people: all<Record<string, unknown>>("SELECT id, name, color, can_compare, created_at FROM people ORDER BY id").map((r) => ({ ...r })),
    hikes,
    tracks: all("SELECT hike_id, geojson, source, length_mi FROM hike_tracks ORDER BY hike_id").map((r) => ({
      hikeId: (r as { hike_id: number }).hike_id,
      source: (r as { source: string }).source,
      lengthMi: (r as { length_mi: number }).length_mi,
      geojson: JSON.parse((r as { geojson: string }).geojson),
    })),
    customPeaks: all<Record<string, unknown>>("SELECT slug, name, elevation_ft, state, range, lat, lon, notes FROM peaks WHERE is_custom = 1").map((r) => ({ ...r })),
    customLists: all<Record<string, unknown>>("SELECT slug, name, short_name, region, description FROM lists WHERE is_custom = 1").map((r) => ({ ...r })),
  }
}

/** A consistent copy of the SQLite database (admin backup). Caller deletes the returned file. */
export function databaseSnapshot(): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hikelog-")), "hikelog-backup.db")
  db().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
  return file
}
