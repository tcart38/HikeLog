import "server-only"
import { all, get, run, tx } from "./db"
import { ApiError } from "./api"
import { recomputeHikeCoverage } from "./coverage"
import { bboxOf, cleanLine, linesLength, M_PER_MI, parseGeoJsonLines, parseGpxLines, simplify, toGeometry, type Line } from "./geo"

export const TRACK_TOLERANCE_M = 10
export const MAX_TRACK_BYTES = 25 * 1024 * 1024
export type TrackSource = "gpx" | "garmin" | "manual"

type TrackRow = {
  hike_id: number
  geojson: string
  simplified: number
  point_count: number
  original_point_count: number | null
  length_mi: number
  min_lon: number | null
  min_lat: number | null
  max_lon: number | null
  max_lat: number | null
  source: TrackSource
  created_at: string
}

export type HikeTrack = {
  hikeId: number
  geojson: ReturnType<typeof toGeometry>
  pointCount: number
  originalPointCount: number | null
  lengthMi: number
  bbox: [number, number, number, number] | null
  source: TrackSource
  createdAt: string
}

/** Parse an uploaded file (GPX or GeoJSON) into lines. Throws a 400 when nothing usable is inside. */
export function parseTrackText(text: string, filename = ""): Line[] {
  const t = text.trimStart()
  let lines: Line[] = []
  if (t.startsWith("{") || t.startsWith("[") || /\.(geo)?json$/i.test(filename)) {
    try {
      lines = parseGeoJsonLines(JSON.parse(t))
    } catch {
      throw new ApiError("That file is not valid GeoJSON", 400)
    }
  } else if (/<gpx[\s>]/i.test(t)) {
    lines = parseGpxLines(t)
  } else {
    throw new ApiError("Unsupported file. Upload a .gpx or GeoJSON (LineString / MultiLineString) file.", 400)
  }
  if (!lines.length) throw new ApiError("No track lines found in that file", 400)
  return lines
}

export function toHikeTrack(r: TrackRow): HikeTrack {
  return {
    hikeId: r.hike_id,
    geojson: JSON.parse(r.geojson),
    pointCount: r.point_count,
    originalPointCount: r.original_point_count,
    lengthMi: r.length_mi,
    bbox: r.min_lon == null ? null : [r.min_lon, r.min_lat!, r.max_lon!, r.max_lat!],
    source: r.source,
    createdAt: r.created_at,
  }
}

export function getTrack(hikeId: number): HikeTrack | null {
  const r = get<TrackRow>("SELECT * FROM hike_tracks WHERE hike_id = ?", hikeId)
  return r ? toHikeTrack(r) : null
}

export function trackSource(hikeId: number): TrackSource | null {
  return get<{ source: TrackSource }>("SELECT source FROM hike_tracks WHERE hike_id = ?", hikeId)?.source ?? null
}

/** Simplify (Douglas-Peucker, ~10 m), store, and recompute redlining coverage for the hike. */
export function saveTrack(hikeId: number, rawLines: Line[], source: TrackSource): HikeTrack {
  if (!get("SELECT 1 FROM hikes WHERE id = ?", hikeId)) throw new ApiError("Hike not found", 404)
  const cleaned = rawLines.map(cleanLine).filter((l) => l.length >= 2)
  if (!cleaned.length) throw new ApiError("The track has no usable points", 400)
  const original = cleaned.reduce((a, l) => a + l.length, 0)
  const lines = cleaned.map((l) => simplify(l, TRACK_TOLERANCE_M)).filter((l) => l.length >= 2)
  const bb = bboxOf(lines)!
  const lengthMi = Math.round((linesLength(lines) / M_PER_MI) * 100) / 100
  const points = lines.reduce((a, l) => a + l.length, 0)
  tx((d) => {
    d.prepare(
      `INSERT INTO hike_tracks (hike_id, geojson, simplified, point_count, original_point_count, length_mi, min_lon, min_lat, max_lon, max_lat, source)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(hike_id) DO UPDATE SET geojson = excluded.geojson, point_count = excluded.point_count,
         original_point_count = excluded.original_point_count, length_mi = excluded.length_mi, min_lon = excluded.min_lon,
         min_lat = excluded.min_lat, max_lon = excluded.max_lon, max_lat = excluded.max_lat, source = excluded.source,
         created_at = datetime('now')`
    ).run(hikeId, JSON.stringify(toGeometry(lines)), points, original, lengthMi, bb[0], bb[1], bb[2], bb[3], source)
  })
  recomputeHikeCoverage(hikeId)
  return getTrack(hikeId)!
}

export function deleteTrack(hikeId: number): boolean {
  const n = tx((d) => {
    d.prepare("DELETE FROM segment_coverage WHERE hike_id = ? AND source = 'track'").run(hikeId)
    return d.prepare("DELETE FROM hike_tracks WHERE hike_id = ?").run(hikeId).changes
  })
  return n > 0
}

export type MapTrack = {
  hikeId: number
  date: string
  title: string | null
  lengthMi: number
  bbox: [number, number, number, number] | null
  people: { id: number; name: string }[]
  geojson: ReturnType<typeof toGeometry>
}

/** Tracks for the map, optionally restricted to a person (counted participants) or one hike. */
export function listMapTracks(opts: { personId?: number; hikeId?: number } = {}): MapTrack[] {
  const where: string[] = []
  const params: unknown[] = []
  if (opts.hikeId) {
    where.push("t.hike_id = ?")
    params.push(opts.hikeId)
  }
  if (opts.personId) {
    where.push("EXISTS (SELECT 1 FROM hike_participants x WHERE x.hike_id = t.hike_id AND x.person_id = ?)")
    params.push(opts.personId)
  }
  const rows = all<TrackRow & { date: string; title: string | null }>(
    `SELECT t.*, h.date, h.title FROM hike_tracks t JOIN hikes h ON h.id = t.hike_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY h.date DESC`,
    ...params
  )
  const people = new Map<number, { id: number; name: string }[]>()
  if (rows.length) {
    const ids = rows.map((r) => r.hike_id)
    for (const p of all<{ hike_id: number; id: number; name: string }>(
      `SELECT hp.hike_id, pe.id, pe.name FROM hike_participants hp JOIN people pe ON pe.id = hp.person_id
       WHERE hp.hike_id IN (${ids.map(() => "?").join(",")}) ORDER BY pe.id`,
      ...ids
    ))
      (people.get(p.hike_id) ?? people.set(p.hike_id, []).get(p.hike_id)!).push({ id: p.id, name: p.name })
  }
  return rows.map((r) => {
    const t = toHikeTrack(r)
    return { hikeId: r.hike_id, date: r.date, title: r.title, lengthMi: r.length_mi, bbox: t.bbox, people: people.get(r.hike_id) ?? [], geojson: t.geojson }
  })
}

// ---------- Garmin hook ----------

/** Keep the (simplified) GPS track of a Garmin activity so importing it later can attach it to the hike. */
export function stashActivityTrack(userId: number, activityId: string, points: { lat: number; lon: number }[]) {
  if (points.length < 2) return
  const line = simplify(cleanLine(points.map((p): [number, number] => [p.lon, p.lat])), TRACK_TOLERANCE_M)
  if (line.length < 2) return
  run("UPDATE garmin_activities SET track_geojson = ? WHERE user_id = ? AND activity_id = ?", JSON.stringify(toGeometry([line])), userId, activityId)
}

/** On import: attach the stashed Garmin track to the hike (never overrides a track the user uploaded). */
export function attachActivityTrack(userId: number, activityRowId: number, hikeId: number) {
  const r = get<{ track_geojson: string | null }>("SELECT track_geojson FROM garmin_activities WHERE id = ? AND user_id = ?", activityRowId, userId)
  if (!r?.track_geojson) return
  const existing = trackSource(hikeId)
  if (existing && existing !== "garmin") return
  const lines = parseGeoJsonLines(JSON.parse(r.track_geojson))
  if (lines.length) saveTrack(hikeId, lines, "garmin")
}
