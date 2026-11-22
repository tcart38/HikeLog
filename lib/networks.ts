import "server-only"
import fs from "node:fs"
import path from "node:path"
import { all, get, run, tx } from "./db"
import { ApiError } from "./api"
import { recomputeNetworkCoverage, type NetworkRow } from "./coverage"
import { M_PER_MI, bboxOf, cleanLine, lineLength, splitLine, toGeometry, type BBox, type Line, type Pos } from "./geo"
import { overpass, type OverpassElement } from "./overpass"

/**
 * Trail network definitions live in data/networks/*.json. A file is a *group* (e.g. the Appalachian Trail) made of
 * one or more *sections* (e.g. AT - New Hampshire). Every section is one downloadable network row.
 *  - route sections: OSM hiking-route relation ids. The relation's ways become one continuous line, cut into
 *    chunks ("mi 0-5") so you can redline part of a long trail.
 *  - paths sections: every named hiking path (highway=path/footway) inside a bbox, grouped by name.
 */
export type SectionDef = {
  slug: string
  name: string
  description?: string
  kind?: "route" | "paths"
  /** route: OSM relation ids whose member ways form the trail */
  relations?: number[]
  /** paths: [south, west, north, east] */
  bbox?: [number, number, number, number]
  segmentLengthM?: number
  /** route: miles per trail chunk (default 5) */
  chunkMi?: number
  /** Overrides the generated Overpass QL (must output `geom tags`) */
  query?: string
}
export type GroupDef = {
  slug: string
  name: string
  description?: string
  note?: string
  kind?: "route" | "paths"
  segmentLengthM?: number
  sections: SectionDef[]
}

export function loadDefinitions(): GroupDef[] {
  const dir = path.join(process.cwd(), "data", "networks")
  if (!fs.existsSync(dir)) return []
  const out: GroupDef[] = []
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as GroupDef)
    } catch (e) {
      console.error(`[networks] could not read ${f}:`, e)
    }
  }
  return out
}

function findSection(slug: string): { group: GroupDef; section: SectionDef } | null {
  for (const group of loadDefinitions()) {
    const section = group.sections.find((s) => s.slug === slug)
    if (section) return { group, section }
  }
  return null
}

/** Make sure every defined section has a row (so it can be listed before it is downloaded). */
export function syncDefinitions() {
  let sort = 0
  for (const g of loadDefinitions())
    for (const s of g.sections) {
      const ref = s.relations ? `relation ${s.relations.join(", ")}` : s.bbox ? `bbox ${s.bbox.join(",")}` : "custom query"
      run(
        `INSERT INTO trail_networks (slug, group_slug, group_name, name, description, source, osm_ref, segment_length_m, sort)
         VALUES (?, ?, ?, ?, ?, 'osm-overpass', ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET group_slug = excluded.group_slug, group_name = excluded.group_name, name = excluded.name,
           description = excluded.description, osm_ref = excluded.osm_ref, segment_length_m = excluded.segment_length_m, sort = excluded.sort`,
        s.slug, g.slug, g.name, s.name, s.description ?? g.description ?? null, ref, s.segmentLengthM ?? g.segmentLengthM ?? 150, sort++
      )
    }
}

export function listNetworks(): NetworkRow[] {
  syncDefinitions()
  return all<NetworkRow>("SELECT * FROM trail_networks ORDER BY sort, name").map((r) => ({ ...r }))
}

export function getNetwork(slug: string): NetworkRow | null {
  syncDefinitions()
  return get<NetworkRow>("SELECT * FROM trail_networks WHERE slug = ?", slug) ?? null
}

/** Group-level info (note about the data source) for the UI. */
export function groupNotes(): Record<string, { name: string; description?: string; note?: string }> {
  return Object.fromEntries(loadDefinitions().map((g) => [g.slug, { name: g.name, description: g.description, note: g.note }]))
}

// ---------- building trails from OSM geometry ----------

const key = (p: Pos) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`

/**
 * Put ways in walking order: follow connected ways end to end, starting from a dead end (the southernmost one when
 * `preferSouth`), and orient each way in the direction of travel. Ways are matched by shared end coordinates.
 */
export function orderWays<T extends { line: Line }>(ways: T[], preferSouth = false): (T & { line: Line })[] {
  const adj = new Map<string, number[]>()
  const add = (k: string, i: number) => {
    const a = adj.get(k)
    if (!a) adj.set(k, [i])
    else if (!a.includes(i)) a.push(i)
  }
  ways.forEach((w, i) => {
    add(key(w.line[0]), i)
    add(key(w.line[w.line.length - 1]), i)
  })
  const used = new Array<boolean>(ways.length).fill(false)
  const out: (T & { line: Line })[] = []
  let remaining = ways.length
  const take = (i: number, reversed: boolean) => {
    used[i] = true
    remaining--
    out.push({ ...ways[i], line: reversed ? ways[i].line.slice().reverse() : ways[i].line })
  }
  while (remaining > 0) {
    // start: a way with a dead-end endpoint; otherwise any unused way
    let start = -1
    let rev = false
    let best = Infinity
    for (let i = 0; i < ways.length; i++) {
      if (used[i]) continue
      const a = ways[i].line[0]
      const b = ways[i].line[ways[i].line.length - 1]
      for (const [p, q, r] of [[a, key(a), false], [b, key(b), true]] as [Pos, string, boolean][]) {
        const leaf = (adj.get(q) ?? []).filter((j) => !used[j]).length === 1
        if (!leaf) continue
        const score = preferSouth ? p[1] : 0
        if (score < best) {
          best = score
          start = i
          rev = r // the dead end is at the end of this line, so walk it reversed
        }
      }
    }
    if (start < 0) start = used.findIndex((u) => !u)
    take(start, rev)
    for (;;) {
      const tail = out[out.length - 1].line
      const k = key(tail[tail.length - 1])
      const next = (adj.get(k) ?? []).find((j) => !used[j])
      if (next === undefined) break
      take(next, key(ways[next].line[0]) !== k)
    }
  }
  return out
}

type Piece = { line: Line; lengthM: number }
type BuiltTrail = { osmId: string; wayIds: string[]; name: string; ref: string | null; parts: Line[]; pieces: Piece[] }

function mergeContiguous(lines: Line[]): Line[] {
  const out: Line[] = []
  for (const l of lines) {
    const last = out[out.length - 1]
    if (last && key(last[last.length - 1]) === key(l[0])) last.push(...l.slice(1))
    else out.push(l.slice())
  }
  return out
}

function piecesOf(line: Line, segLen: number): Piece[] {
  return splitLine(line, segLen).map((l) => ({ line: l, lengthM: lineLength(l) }))
}

const toLine = (g?: { lat: number; lon: number }[]): Line => cleanLine((g ?? []).map((p): Pos => [p.lon, p.lat]))

/** Named paths grouped by name, then split into connected components (so two unrelated "Loop Trail"s stay separate). */
export function buildPathTrails(elements: OverpassElement[], segLen: number): BuiltTrail[] {
  type W = { id: number; name: string; ref: string | null; line: Line }
  const byName = new Map<string, W[]>()
  for (const e of elements) {
    if (e.type !== "way" || !e.geometry) continue
    const name = e.tags?.name?.trim()
    if (!name) continue
    const line = toLine(e.geometry)
    if (line.length < 2 || lineLength(line) < 15) continue
    const k = name.toLowerCase()
    ;(byName.get(k) ?? byName.set(k, []).get(k)!).push({ id: e.id, name, ref: e.tags?.ref ?? null, line })
  }
  const trails: BuiltTrail[] = []
  for (const ways of byName.values()) {
    // connected components over shared endpoints
    const parent = ways.map((_, i) => i)
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    const seen = new Map<string, number>()
    ways.forEach((w, i) => {
      for (const p of [w.line[0], w.line[w.line.length - 1]]) {
        const k = key(p)
        const j = seen.get(k)
        if (j === undefined) seen.set(k, i)
        else parent[find(i)] = find(j)
      }
    })
    const comps = new Map<number, W[]>()
    ways.forEach((w, i) => (comps.get(find(i)) ?? comps.set(find(i), []).get(find(i))!).push(w))
    for (const comp of comps.values()) {
      const ordered = orderWays(comp)
      const pieces = ordered.flatMap((w) => piecesOf(w.line, segLen))
      const len = pieces.reduce((a, p) => a + p.lengthM, 0)
      if (len < 40) continue
      const ids = comp.map((w) => w.id).sort((a, b) => a - b)
      trails.push({
        osmId: String(ids[0]),
        wayIds: ids.map(String),
        name: comp[0].name,
        ref: comp.find((w) => w.ref)?.ref ?? null,
        parts: mergeContiguous(ordered.map((w) => w.line)),
        pieces,
      })
    }
  }
  return trails.sort((a, b) => a.name.localeCompare(b.name) || a.osmId.localeCompare(b.osmId))
}

/** A route relation: ways from the relation in walking order, cut into ~chunkMi trails. */
export function buildRouteTrails(elements: OverpassElement[], name: string, ref: string | null, segLen: number, chunkMi: number): BuiltTrail[] {
  const skipRoles = /^(alternate|alternative|approach|excursion|side_trail|connection|connector|spur)/i
  const seen = new Set<number>()
  const ways: { line: Line; id: number }[] = []
  for (const rel of elements) {
    if (rel.type !== "relation") continue
    for (const m of rel.members ?? []) {
      if (m.type !== "way" || !m.geometry || skipRoles.test(m.role) || seen.has(m.ref)) continue
      seen.add(m.ref)
      const line = toLine(m.geometry)
      if (line.length >= 2) ways.push({ line, id: m.ref })
    }
  }
  if (!ways.length) return []
  const ordered = orderWays(ways, true)
  const chunkM = chunkMi * M_PER_MI
  const trails: BuiltTrail[] = []
  let cur: { pieces: Piece[]; ids: Set<number>; startM: number } | null = null
  let acc = 0
  const flush = () => {
    if (!cur || !cur.pieces.length) return
    const len = cur.pieces.reduce((a, p) => a + p.lengthM, 0)
    const a = Math.round(cur.startM / M_PER_MI)
    const b = Math.round((cur.startM + len) / M_PER_MI)
    trails.push({
      osmId: `chunk-${trails.length + 1}`,
      wayIds: [...cur.ids].map(String),
      name: `${name} · mi ${a}–${Math.max(b, a + 1)}`,
      ref,
      parts: mergeContiguous(cur.pieces.map((p) => p.line)),
      pieces: cur.pieces,
    })
    acc += len
    cur = null
  }
  for (const w of ordered)
    for (const p of piecesOf(w.line, segLen)) {
      if (!cur) cur = { pieces: [], ids: new Set(), startM: acc }
      cur.pieces.push(p)
      cur.ids.add(w.id)
      if (cur.pieces.reduce((a, x) => a + x.lengthM, 0) >= chunkM) flush()
    }
  flush()
  return trails
}

export function pathsQuery(b: [number, number, number, number]): string {
  return `[out:json][timeout:300];
way["highway"~"^(path|footway)$"]["name"]["access"!~"^(private|no)$"]["foot"!~"^(no|private)$"]["footway"!~"^(sidewalk|crossing)$"]["indoor"!~"."](${b.join(",")});
out tags geom qt;`
}

/** Split [south, west, north, east] into tiles no bigger than maxLat x maxLon degrees. */
export function tilesOf(b: [number, number, number, number], maxLat = 0.3, maxLon = 0.4): [number, number, number, number][] {
  const rows = Math.max(1, Math.ceil((b[2] - b[0]) / maxLat))
  const cols = Math.max(1, Math.ceil((b[3] - b[1]) / maxLon))
  const out: [number, number, number, number][] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push([
        +(b[0] + ((b[2] - b[0]) * r) / rows).toFixed(4),
        +(b[1] + ((b[3] - b[1]) * c) / cols).toFixed(4),
        +(b[0] + ((b[2] - b[0]) * (r + 1)) / rows).toFixed(4),
        +(b[1] + ((b[3] - b[1]) * (c + 1)) / cols).toFixed(4),
      ])
  return out
}

export function routeQuery(ids: number[]): string {
  return `[out:json][timeout:300];
rel(id:${ids.join(",")});
out geom;`
}

// ---------- download + store ----------

const running = new Set<string>()

export type DownloadResult = { slug: string; name: string; trails: number; segments: number; totalMi: number; seconds: number; coverage: { hikes: number; segments: number } }

export async function downloadNetwork(slug: string, onStatus?: (msg: string) => void): Promise<DownloadResult> {
  const def = findSection(slug)
  if (!def) throw new ApiError(`Unknown network: ${slug}`, 404)
  if (running.has(slug)) throw new ApiError("That network is already downloading", 409)
  running.add(slug)
  const started = Date.now()
  try {
    syncDefinitions()
    const { group, section } = def
    const kind = section.kind ?? group.kind ?? (section.relations ? "route" : "paths")
    const segLen = section.segmentLengthM ?? group.segmentLengthM ?? 150
    const query = section.query ?? (kind === "route" ? routeQuery(section.relations ?? []) : pathsQuery(section.bbox as [number, number, number, number]))
    if (!section.query && kind === "route" && !section.relations?.length) throw new ApiError("Section has no relations", 500)
    if (!section.query && kind === "paths" && section.bbox?.length !== 4) throw new ApiError("Section has no bbox", 500)
    let elements: OverpassElement[]
    if (!section.query && kind === "paths") {
      // Big areas time out on the shared servers, so ask for tiles of at most ~0.3 x 0.4 degrees and merge by way id.
      const byId = new Map<number, OverpassElement>()
      for (const tile of tilesOf(section.bbox as [number, number, number, number]))
        {
          for (const e of await overpass(pathsQuery(tile), { onAttempt: onStatus })) byId.set(e.id, e)
          console.log(`[networks] ${slug}: tile ${tile.join(",")} done, ${byId.size} ways so far`)
        }
      elements = [...byId.values()]
    } else elements = await overpass(query, { onAttempt: onStatus })
    const built =
      kind === "route"
        ? buildRouteTrails(elements, section.name, "AT", segLen, section.chunkMi ?? 5)
        : buildPathTrails(elements, segLen)
    if (!built.length) throw new ApiError("Overpass returned no trails for that network", 502)
    return store(slug, section, query, segLen, built, started)
  } finally {
    running.delete(slug)
  }
}

function store(slug: string, section: SectionDef, query: string, segLen: number, built: BuiltTrail[], started: number): DownloadResult {
  const net = get<{ id: number }>("SELECT id FROM trail_networks WHERE slug = ?", slug)!
  const nid = net.id
  const allLines = built.flatMap((t) => t.parts)
  const bb = bboxOf(allLines) as BBox
  let totalM = 0
  let segCount = 0
  tx((d) => {
    // keep hand-made redlining across re-downloads: remember it by (trail osm id, segment index)
    const manual = d
      .prepare(
        `SELECT t.osm_id, s.idx, c.person_id, c.hike_id, c.covered_at FROM segment_coverage c
         JOIN trail_segments s ON s.id = c.segment_id JOIN trails t ON t.id = s.trail_id
         WHERE s.network_id = ? AND c.source = 'manual'`
      )
      .all(nid) as { osm_id: string; idx: number; person_id: number; hike_id: number | null; covered_at: string | null }[]
    d.prepare("DELETE FROM trails WHERE network_id = ?").run(nid)

    const insTrail = d.prepare(
      `INSERT INTO trails (network_id, osm_id, osm_way_ids, name, ref, geojson, length_mi, min_lon, min_lat, max_lon, max_lat) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    const insSeg = d.prepare(
      `INSERT INTO trail_segments (trail_id, network_id, idx, geojson, length_m, min_lon, min_lat, max_lon, max_lat) VALUES (?,?,?,?,?,?,?,?,?)`
    )
    const segIdByKey = new Map<string, number>()
    for (const t of built) {
      const len = t.pieces.reduce((a, p) => a + p.lengthM, 0)
      const tb = bboxOf(t.parts) as BBox
      const tid = Number(
        insTrail.run(nid, t.osmId, JSON.stringify(t.wayIds), t.name, t.ref, JSON.stringify(toGeometry(t.parts)), Math.round((len / M_PER_MI) * 1000) / 1000, tb[0], tb[1], tb[2], tb[3]).lastInsertRowid
      )
      t.pieces.forEach((p, i) => {
        const b = bboxOf([p.line]) as BBox
        const sid = Number(insSeg.run(tid, nid, i, JSON.stringify(p.line), p.lengthM, b[0], b[1], b[2], b[3]).lastInsertRowid)
        segIdByKey.set(`${t.osmId}#${i}`, sid)
        totalM += p.lengthM
        segCount++
      })
    }
    const insCov = d.prepare("INSERT OR IGNORE INTO segment_coverage (segment_id, person_id, hike_id, covered_at, source) VALUES (?,?,?,?, 'manual')")
    for (const m of manual) {
      const sid = segIdByKey.get(`${m.osm_id}#${m.idx}`)
      if (sid) insCov.run(sid, m.person_id, m.hike_id, m.covered_at)
    }
    d.prepare(
      `UPDATE trail_networks SET osm_query = ?, fetched_at = datetime('now'), total_length_mi = ?, trail_count = ?, segment_count = ?, segment_length_m = ?,
         min_lon = ?, min_lat = ?, max_lon = ?, max_lat = ? WHERE id = ?`
    ).run(query, Math.round((totalM / M_PER_MI) * 10) / 10, built.length, segCount, segLen, bb[0], bb[1], bb[2], bb[3], nid)
  })
  const coverage = recomputeNetworkCoverage(nid)
  return {
    slug,
    name: section.name,
    trails: built.length,
    segments: segCount,
    totalMi: Math.round((totalM / M_PER_MI) * 10) / 10,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    coverage,
  }
}
