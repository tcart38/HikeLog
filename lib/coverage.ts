import "server-only"
import { all, get, tx } from "./db"
import { ApiError } from "./api"
import { PointIndex, bboxOf, densify, fromGeometry, samplePoints, type Line, type Pos } from "./geo"

/** A segment counts as hiked when at least this share of its sample points is near the track. */
export const COVER_SHARE = 0.7
/** ...where "near" means within this many metres. */
export const COVER_RADIUS_M = 30
const SAMPLE_STEP_M = 20
/** A trail counts as "done" at this share covered (GPS gaps at junctions shouldn't leave it at 97%). */
export const TRAIL_DONE_SHARE = 0.95

type SegRow = { id: number; geojson: string }

/** Share of a segment's sample points near the track index. */
function share(seg: Line, idx: PointIndex): number {
  const pts = samplePoints(seg, SAMPLE_STEP_M)
  if (!pts.length) return 0
  let near = 0
  for (const p of pts) if (idx.near(p)) near++
  return near / pts.length
}

/** Insert track coverage for one hike. `networkId` limits it to one network. */
function coverHike(hikeId: number, networkId?: number): number {
  const track = get<{ geojson: string; min_lon: number; min_lat: number; max_lon: number; max_lat: number }>(
    "SELECT geojson, min_lon, min_lat, max_lon, max_lat FROM hike_tracks WHERE hike_id = ?",
    hikeId
  )
  if (!track) return 0
  const hike = get<{ date: string; end_date: string | null }>("SELECT date, end_date FROM hikes WHERE id = ?", hikeId)
  if (!hike) return 0
  const people = all<{ person_id: number }>("SELECT person_id FROM hike_participants WHERE hike_id = ? AND counts = 1", hikeId).map((r) => r.person_id)
  if (!people.length) return 0

  const pad = 0.0006 // ~65 m, beyond the 30 m radius
  const segs = all<SegRow>(
    `SELECT id, geojson FROM trail_segments WHERE max_lat >= ? AND min_lat <= ? AND max_lon >= ? AND min_lon <= ? ${networkId ? "AND network_id = ?" : ""}`,
    track.min_lat - pad,
    track.max_lat + pad,
    track.min_lon - pad,
    track.max_lon + pad,
    ...(networkId ? [networkId] : [])
  )
  if (!segs.length) return 0

  const lines = fromGeometry(JSON.parse(track.geojson))
  const points: Pos[] = lines.flatMap((l) => densify(l, 10))
  const idx = new PointIndex(points, COVER_RADIUS_M)
  const hit = segs.filter((s) => share(JSON.parse(s.geojson) as Line, idx) >= COVER_SHARE).map((s) => s.id)
  if (!hit.length) return 0
  tx((d) => {
    const ins = d.prepare("INSERT OR IGNORE INTO segment_coverage (segment_id, person_id, hike_id, covered_at, source) VALUES (?, ?, ?, ?, 'track')")
    for (const sid of hit) for (const pid of people) ins.run(sid, pid, hikeId, hike.date)
  })
  return hit.length
}

/** Rebuild track coverage for a hike (after the track, the participants or the date changed). */
export function recomputeHikeCoverage(hikeId: number): number {
  tx((d) => d.prepare("DELETE FROM segment_coverage WHERE hike_id = ? AND source = 'track'").run(hikeId))
  return coverHike(hikeId)
}

/** Rebuild track coverage for every hike that overlaps a network (after a download). */
export function recomputeNetworkCoverage(networkId: number): { hikes: number; segments: number } {
  const net = get<{ min_lon: number | null; min_lat: number | null; max_lon: number | null; max_lat: number | null }>(
    "SELECT min_lon, min_lat, max_lon, max_lat FROM trail_networks WHERE id = ?",
    networkId
  )
  if (!net || net.min_lon == null) return { hikes: 0, segments: 0 }
  tx((d) =>
    d.prepare("DELETE FROM segment_coverage WHERE source = 'track' AND segment_id IN (SELECT id FROM trail_segments WHERE network_id = ?)").run(networkId)
  )
  const hikes = all<{ hike_id: number }>(
    "SELECT hike_id FROM hike_tracks WHERE max_lon >= ? AND min_lon <= ? AND max_lat >= ? AND min_lat <= ?",
    net.min_lon,
    net.max_lon,
    net.min_lat,
    net.max_lat
  )
  let segments = 0
  for (const h of hikes) segments += coverHike(h.hike_id, networkId)
  return { hikes: hikes.length, segments }
}

/** Drop track coverage for a hike only (manual marks stay). */
export function clearHikeCoverage(hikeId: number) {
  tx((d) => d.prepare("DELETE FROM segment_coverage WHERE hike_id = ? AND source = 'track'").run(hikeId))
}

// ---------- manual redlining ----------

export type ManualInput = {
  trailId: number
  personId: number
  /** Segment index range (inclusive). Omit both for the whole trail. */
  fromIdx?: number | null
  toIdx?: number | null
  covered: boolean
  date?: string | null
  hikeId?: number | null
}

export function setManualCoverage(inp: ManualInput): { segments: number } {
  const trail = get<{ id: number }>("SELECT id FROM trails WHERE id = ?", inp.trailId)
  if (!trail) throw new ApiError("Trail not found", 404)
  if (!get("SELECT 1 FROM people WHERE id = ?", inp.personId)) throw new ApiError("Person not found", 404)
  if (inp.hikeId && !get("SELECT 1 FROM hikes WHERE id = ?", inp.hikeId)) throw new ApiError("Hike not found", 404)
  const from = inp.fromIdx ?? 0
  const to = inp.toIdx ?? 1e9
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const segs = all<{ id: number }>("SELECT id FROM trail_segments WHERE trail_id = ? AND idx BETWEEN ? AND ?", inp.trailId, lo, hi)
  tx((d) => {
    if (inp.covered) {
      const ins = d.prepare("INSERT INTO segment_coverage (segment_id, person_id, hike_id, covered_at, source) VALUES (?, ?, ?, ?, 'manual') ON CONFLICT DO NOTHING")
      for (const s of segs) ins.run(s.id, inp.personId, inp.hikeId ?? null, inp.date ?? null)
    } else {
      const del = d.prepare("DELETE FROM segment_coverage WHERE segment_id = ? AND person_id = ? AND source = 'manual'")
      for (const s of segs) del.run(s.id, inp.personId)
    }
  })
  return { segments: segs.length }
}

// ---------- progress ----------

export type NetworkRow = {
  id: number
  slug: string
  group_slug: string | null
  group_name: string | null
  name: string
  description: string | null
  source: string
  osm_ref: string | null
  segment_length_m: number
  fetched_at: string | null
  total_length_mi: number
  trail_count: number
  segment_count: number
  min_lon: number | null
  min_lat: number | null
  max_lon: number | null
  max_lat: number | null
}

const MI = 1609.344
const mi1 = (m: number) => Math.round((m / MI) * 10) / 10

export type PersonCoverage = { personId: number; coveredMi: number; totalMi: number; percent: number; trailsDone: number }

/** Covered miles per person for one network (any coverage source counts). */
export function networkCoverage(networkId: number, personIds: number[]): PersonCoverage[] {
  const net = get<{ total: number | null; trails: number }>(
    "SELECT SUM(length_m) total, COUNT(DISTINCT trail_id) trails FROM trail_segments WHERE network_id = ?",
    networkId
  )
  const total = net?.total ?? 0
  const done = trailsDone(networkId, personIds)
  if (!personIds.length) return []
  const rows = all<{ person_id: number; m: number }>(
    `SELECT c.person_id, SUM(s.length_m) m FROM trail_segments s
     JOIN (SELECT DISTINCT segment_id, person_id FROM segment_coverage WHERE person_id IN (${personIds.map(() => "?").join(",")})) c ON c.segment_id = s.id
     WHERE s.network_id = ? GROUP BY c.person_id`,
    ...personIds,
    networkId
  )
  const by = new Map(rows.map((r) => [r.person_id, r.m]))
  return personIds.map((pid) => {
    const m = by.get(pid) ?? 0
    return { personId: pid, coveredMi: mi1(m), totalMi: mi1(total), percent: total ? Math.round((m / total) * 1000) / 10 : 0, trailsDone: done.get(pid) ?? 0 }
  })
}

function trailsDone(networkId: number, personIds: number[]): Map<number, number> {
  const out = new Map<number, number>()
  if (!personIds.length) return out
  for (const t of trailProgress(networkId, personIds)) for (const pid of personIds) if (t.byPerson[pid].share >= TRAIL_DONE_SHARE) out.set(pid, (out.get(pid) ?? 0) + 1)
  return out
}

export type TrailProgress = {
  id: number
  name: string
  ref: string | null
  lengthMi: number
  segments: number
  byPerson: Record<number, { coveredMi: number; share: number; percent: number }>
  /** Miles that none of the selected people have covered. */
  neededByAllMi: number
  bbox: [number, number, number, number] | null
}

/** Every trail in a network with per-person coverage and the miles nobody has done yet. */
export function trailProgress(networkId: number, personIds: number[]): TrailProgress[] {
  const trails = all<{ id: number; name: string; ref: string | null; length_mi: number; min_lon: number | null; min_lat: number | null; max_lon: number | null; max_lat: number | null }>(
    "SELECT id, name, ref, length_mi, min_lon, min_lat, max_lon, max_lat FROM trails WHERE network_id = ?",
    networkId
  )
  const segs = all<{ id: number; trail_id: number; length_m: number }>("SELECT id, trail_id, length_m FROM trail_segments WHERE network_id = ?", networkId)
  const cov = personIds.length
    ? all<{ segment_id: number; person_id: number }>(
        `SELECT DISTINCT c.segment_id, c.person_id FROM segment_coverage c JOIN trail_segments s ON s.id = c.segment_id
         WHERE s.network_id = ? AND c.person_id IN (${personIds.map(() => "?").join(",")})`,
        networkId,
        ...personIds
      )
    : []
  const covBySeg = new Map<number, Set<number>>()
  for (const c of cov) (covBySeg.get(c.segment_id) ?? covBySeg.set(c.segment_id, new Set()).get(c.segment_id)!).add(c.person_id)
  const segsByTrail = new Map<number, typeof segs>()
  for (const s of segs) (segsByTrail.get(s.trail_id) ?? segsByTrail.set(s.trail_id, []).get(s.trail_id)!).push(s)
  return trails.map((t) => {
    const ss = segsByTrail.get(t.id) ?? []
    const total = ss.reduce((a, s) => a + s.length_m, 0)
    const byPerson: TrailProgress["byPerson"] = {}
    for (const pid of personIds) {
      const m = ss.reduce((a, s) => a + (covBySeg.get(s.id)?.has(pid) ? s.length_m : 0), 0)
      byPerson[pid] = { coveredMi: mi1(m), share: total ? m / total : 0, percent: total ? Math.round((m / total) * 100) : 0 }
    }
    const needed = ss.reduce((a, s) => a + (personIds.some((pid) => covBySeg.get(s.id)?.has(pid)) ? 0 : s.length_m), 0)
    return {
      id: t.id,
      name: t.name,
      ref: t.ref,
      lengthMi: Math.round(t.length_mi * 100) / 100,
      segments: ss.length,
      byPerson,
      neededByAllMi: Math.round((needed / MI) * 100) / 100,
      bbox: t.min_lon == null ? null : [t.min_lon, t.min_lat!, t.max_lon!, t.max_lat!],
    }
  })
}

// ---------- map geometry ----------

type SegGeo = { id: number; trail_id: number; idx: number; geojson: string }

/**
 * Simplified geometry of a network for the map: consecutive segments of a trail that share a coverage state are
 * merged into one feature, so a 17,000-segment network is a few thousand features, not 17,000.
 * `covered` is 1 when the first listed person has covered it; `by` lists every listed person who has.
 */
export function networkGeoJson(networkId: number, personIds: number[]) {
  const trails = new Map(all<{ id: number; name: string; ref: string | null }>("SELECT id, name, ref FROM trails WHERE network_id = ?", networkId).map((t) => [t.id, t]))
  const segs = all<SegGeo>("SELECT id, trail_id, idx, geojson FROM trail_segments WHERE network_id = ? ORDER BY trail_id, idx", networkId)
  const cov = personIds.length
    ? all<{ segment_id: number; person_id: number }>(
        `SELECT DISTINCT c.segment_id, c.person_id FROM segment_coverage c JOIN trail_segments s ON s.id = c.segment_id
         WHERE s.network_id = ? AND c.person_id IN (${personIds.map(() => "?").join(",")})`,
        networkId,
        ...personIds
      )
    : []
  const byseg = new Map<number, number[]>()
  for (const c of cov) (byseg.get(c.segment_id) ?? byseg.set(c.segment_id, []).get(c.segment_id)!).push(c.person_id)

  type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: { type: "MultiLineString"; coordinates: Line[] } }
  const features: Feature[] = []
  let cur: { trail: number; key: string; by: number[]; fromIdx: number; toIdx: number; parts: Line[] } | null = null
  const flush = () => {
    if (!cur) return
    const t = trails.get(cur.trail)!
    features.push({
      type: "Feature",
      properties: {
        trailId: cur.trail,
        name: t.name,
        ref: t.ref,
        covered: personIds.length && cur.by.includes(personIds[0]) ? 1 : 0,
        by: cur.by.join(","),
        fromIdx: cur.fromIdx,
        toIdx: cur.toIdx,
      },
      geometry: { type: "MultiLineString", coordinates: cur.parts },
    })
    cur = null
  }
  for (const s of segs) {
    const by = (byseg.get(s.id) ?? []).sort((a, b) => a - b)
    const key = by.join(",")
    if (!cur || cur.trail !== s.trail_id || cur.key !== key) {
      flush()
      cur = { trail: s.trail_id, key, by, fromIdx: s.idx, toIdx: s.idx, parts: [] }
    }
    cur.toIdx = s.idx
    const line = JSON.parse(s.geojson) as Line
    const last = cur.parts[cur.parts.length - 1]
    // continue the previous part when the segment starts where it ended
    if (last && Math.abs(last[last.length - 1][0] - line[0][0]) < 2e-5 && Math.abs(last[last.length - 1][1] - line[0][1]) < 2e-5) last.push(...line.slice(1))
    else cur.parts.push(line.slice())
  }
  flush()
  return { type: "FeatureCollection" as const, features }
}

/** Segments of one trail, for the manual "pick a section" mode. */
export function trailSegments(trailId: number, personIds: number[]) {
  const trail = get<{ id: number; name: string; network_id: number; length_mi: number }>("SELECT id, name, network_id, length_mi FROM trails WHERE id = ?", trailId)
  if (!trail) throw new ApiError("Trail not found", 404)
  const segs = all<{ id: number; idx: number; geojson: string; length_m: number }>("SELECT id, idx, geojson, length_m FROM trail_segments WHERE trail_id = ? ORDER BY idx", trailId)
  const cov = personIds.length
    ? all<{ segment_id: number; person_id: number; source: string; covered_at: string | null }>(
        `SELECT segment_id, person_id, source, covered_at FROM segment_coverage WHERE person_id IN (${personIds.map(() => "?").join(",")})
         AND segment_id IN (SELECT id FROM trail_segments WHERE trail_id = ?)`,
        ...personIds,
        trailId
      )
    : []
  const by = new Map<number, { person: number; source: string }[]>()
  for (const c of cov) (by.get(c.segment_id) ?? by.set(c.segment_id, []).get(c.segment_id)!).push({ person: c.person_id, source: c.source })
  return {
    trail: { id: trail.id, name: trail.name, networkId: trail.network_id, lengthMi: Math.round(trail.length_mi * 100) / 100 },
    segments: segs.map((s) => ({ idx: s.idx, lengthM: Math.round(s.length_m), coords: JSON.parse(s.geojson) as Line, coveredBy: by.get(s.id) ?? [] })),
    bbox: bboxOf(segs.map((s) => JSON.parse(s.geojson) as Line)),
  }
}


/** Miles of each network a hike's GPS track covered (distinct segments, any one participant). */
export function hikeCoverageSummary(hikeId: number): { slug: string; name: string; miles: number; trails: number }[] {
  return all<{ slug: string; name: string; m: number; trails: number }>(
    `SELECT n.slug, n.name, SUM(s.length_m) m, COUNT(DISTINCT s.trail_id) trails
     FROM (SELECT DISTINCT segment_id FROM segment_coverage WHERE hike_id = ? AND source = 'track') c
     JOIN trail_segments s ON s.id = c.segment_id JOIN trail_networks n ON n.id = s.network_id
     GROUP BY n.id ORDER BY m DESC`,
    hikeId
  ).map((r) => ({ slug: r.slug, name: r.name, miles: mi1(r.m), trails: r.trails }))
}
