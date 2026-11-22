import "server-only"
import { z } from "zod"
import { all, get, tx } from "./db"
import { recomputeHikeCoverage } from "./coverage"
import { purgeHikeMedia } from "./media"
import { matchPeaks, type MatchResult } from "./peaks/match"
import { appTimeZone, isWinterHike, seasonOf, type Season } from "./seasons"

export const conditionsSchema = z.enum(["snow", "no_snow", "mix"])
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, "Not a real calendar date")

/** Participant: person id, name, or {person, counts, note}. */
const participantSchema = z.union([
  z.number().int(),
  z.string().min(1),
  z.object({
    person: z.union([z.number().int(), z.string().min(1)]),
    counts: z.boolean().optional(),
    note: z.string().optional(),
  }),
])

export const hikeInputSchema = z.object({
  date: dateSchema,
  endDate: dateSchema.nullish(),
  title: z.string().max(200).nullish(),
  /** Peak ids, slugs or free-text names ("Owl's Head", "Wildcat A"). Comma-separated strings are split. */
  peaks: z.array(z.union([z.number().int(), z.string().min(1)])).default([]),
  /** Who was on the hike. Unknown names create new people. Omit to use the caller's own person. */
  participants: z.array(participantSchema).optional(),
  conditions: conditionsSchema.nullish(),
  weather: z.string().nullish(),
  trailConditions: z.string().nullish(),
  notes: z.string().nullish(),
  distanceMi: z.number().nonnegative().nullish(),
  elevationGainFt: z.number().int().nonnegative().nullish(),
  durationMin: z.number().int().nonnegative().nullish(),
  routeType: z.string().max(40).nullish(),
  otherLists: z.string().nullish(),
  /** Optional idempotency key: re-posting the same externalId updates instead of duplicating. */
  externalId: z.string().max(200).nullish(),
  /** Hint for ambiguous names (e.g. "Mount Abraham"): 2-letter state or a list slug. */
  stateHint: z.string().length(2).nullish(),
  listHint: z.string().nullish(),
  /** If true, reject the hike when any peak name is unmatched/ambiguous. Default false: keep them as unmatched text. */
  strictPeaks: z.boolean().optional(),
})
export type HikeInput = z.input<typeof hikeInputSchema>

export type HikeRow = {
  id: number
  date: string
  end_date: string | null
  title: string | null
  conditions: "snow" | "no_snow" | "mix" | null
  weather: string | null
  trail_conditions: string | null
  notes: string | null
  distance_mi: number | null
  elevation_gain_ft: number | null
  duration_min: number | null
  route_type: string | null
  other_lists: string | null
  unmatched_peaks: string | null
  source: string
  external_id: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export type Hike = {
  id: number
  date: string
  endDate: string | null
  title: string | null
  season: Season
  isWinter: boolean
  conditions: HikeRow["conditions"]
  weather: string | null
  trailConditions: string | null
  notes: string | null
  distanceMi: number | null
  elevationGainFt: number | null
  durationMin: number | null
  routeType: string | null
  otherLists: string | null
  unmatchedPeaks: string[]
  source: string
  externalId: string | null
  createdBy: number | null
  createdAt: string
  updatedAt: string
  peaks: { id: number; slug: string; name: string; elevationFt: number | null; state: string | null }[]
  participants: { id: number; name: string; color: string | null; counts: boolean; note: string | null }[]
}

export class HikeError extends Error {
  constructor(message: string, public details?: unknown, public status = 400) {
    super(message)
  }
}

function toHike(r: HikeRow): Hike {
  const tz = appTimeZone()
  return {
    id: r.id,
    date: r.date,
    endDate: r.end_date,
    title: r.title,
    season: seasonOf(r.date, tz),
    isWinter: isWinterHike(r.date, r.end_date, tz),
    conditions: r.conditions,
    weather: r.weather,
    trailConditions: r.trail_conditions,
    notes: r.notes,
    distanceMi: r.distance_mi,
    elevationGainFt: r.elevation_gain_ft,
    durationMin: r.duration_min,
    routeType: r.route_type,
    otherLists: r.other_lists,
    unmatchedPeaks: r.unmatched_peaks ? r.unmatched_peaks.split("\n").filter(Boolean) : [],
    source: r.source,
    externalId: r.external_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    peaks: [],
    participants: [],
  }
}

function hydrate(rows: HikeRow[]): Hike[] {
  if (!rows.length) return []
  const hikes = rows.map(toHike)
  const byId = new Map(hikes.map((h) => [h.id, h]))
  const ids = hikes.map((h) => h.id)
  const ph = ids.map(() => "?").join(",")
  for (const p of all<{ hike_id: number; id: number; slug: string; name: string; elevation_ft: number | null; state: string | null }>(
    `SELECT hp.hike_id, p.id, p.slug, p.name, p.elevation_ft, p.state FROM hike_peaks hp JOIN peaks p ON p.id = hp.peak_id
     WHERE hp.hike_id IN (${ph}) ORDER BY hp.ordinal`,
    ...ids
  ))
    byId.get(p.hike_id)!.peaks.push({ id: p.id, slug: p.slug, name: p.name, elevationFt: p.elevation_ft, state: p.state })
  for (const p of all<{ hike_id: number; id: number; name: string; color: string | null; counts: number; note: string | null }>(
    `SELECT hp.hike_id, pe.id, pe.name, pe.color, hp.counts, hp.note FROM hike_participants hp JOIN people pe ON pe.id = hp.person_id
     WHERE hp.hike_id IN (${ph}) ORDER BY pe.name`,
    ...ids
  ))
    byId.get(p.hike_id)!.participants.push({ id: p.id, name: p.name, color: p.color, counts: !!p.counts, note: p.note })
  return hikes
}

export function getHike(id: number): Hike | null {
  const r = get<HikeRow>("SELECT * FROM hikes WHERE id = ?", id)
  return r ? hydrate([r])[0] : null
}

export type HikeFilter = {
  personId?: number
  peakId?: number
  listSlug?: string
  from?: string
  to?: string
  q?: string
  limit?: number
  offset?: number
}

export function listHikes(f: HikeFilter = {}): { hikes: Hike[]; total: number } {
  const where: string[] = []
  const params: unknown[] = []
  if (f.personId) {
    where.push("EXISTS (SELECT 1 FROM hike_participants x WHERE x.hike_id = h.id AND x.person_id = ?)")
    params.push(f.personId)
  }
  if (f.peakId) {
    where.push("EXISTS (SELECT 1 FROM hike_peaks x WHERE x.hike_id = h.id AND x.peak_id = ?)")
    params.push(f.peakId)
  }
  if (f.listSlug) {
    where.push(
      "EXISTS (SELECT 1 FROM hike_peaks x JOIN list_peaks lp ON lp.peak_id = x.peak_id JOIN lists l ON l.id = lp.list_id WHERE x.hike_id = h.id AND l.slug = ?)"
    )
    params.push(f.listSlug)
  }
  if (f.from) {
    where.push("h.date >= ?")
    params.push(f.from)
  }
  if (f.to) {
    where.push("h.date <= ?")
    params.push(f.to)
  }
  if (f.q) {
    where.push(
      "(h.title LIKE ? OR h.notes LIKE ? OR h.weather LIKE ? OR h.trail_conditions LIKE ? OR EXISTS (SELECT 1 FROM hike_peaks x JOIN peaks p ON p.id = x.peak_id WHERE x.hike_id = h.id AND p.name LIKE ?))"
    )
    const like = `%${f.q}%`
    params.push(like, like, like, like, like)
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : ""
  const total = get<{ n: number }>(`SELECT COUNT(*) n FROM hikes h ${w}`, ...params)!.n
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 1000)
  const rows = all<HikeRow>(
    `SELECT h.* FROM hikes h ${w} ORDER BY h.date DESC, h.id DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    f.offset ?? 0
  )
  return { hikes: hydrate(rows), total }
}

export type SaveResult = { hike: Hike; peakMatches: MatchResult[]; created: boolean }

/** Create or (with id / matching externalId) update a hike. */
export function saveHike(
  input: HikeInput,
  opts: { userId: number | null; userPersonId?: number | null; source?: "web" | "api" | "import"; id?: number }
): SaveResult {
  const data = hikeInputSchema.parse(input)
  if (data.endDate && data.endDate < data.date) throw new HikeError("endDate is before date")

  const names = data.peaks.map(String)
  const matches = matchPeaks(names, { state: data.stateHint, listSlug: data.listHint })
  const bad = matches.filter((m) => m.status !== "matched")
  if (data.strictPeaks && bad.length) throw new HikeError("Some peaks could not be matched", { peakMatches: matches }, 422)
  const peakIds = [
    ...new Set(matches.flatMap((m) => (m.status === "matched" ? [m.peak.id] : []))),
  ]
  const unmatched = bad.map((m) => m.input).join("\n") || null

  const saved = tx((d) => {
    let id = opts.id
    if (!id && data.externalId) {
      const ex = d.prepare("SELECT id FROM hikes WHERE external_id = ?").get(data.externalId) as { id: number } | undefined
      id = ex?.id
    }
    const cols = [
      data.date,
      data.endDate ?? null,
      data.title ?? null,
      data.conditions ?? null,
      data.weather ?? null,
      data.trailConditions ?? null,
      data.notes ?? null,
      data.distanceMi ?? null,
      data.elevationGainFt ?? null,
      data.durationMin ?? null,
      data.routeType ?? null,
      data.otherLists ?? null,
      unmatched,
      data.externalId ?? null,
    ]
    let created = false
    if (id) {
      const res = d
        .prepare(
          `UPDATE hikes SET date=?, end_date=?, title=?, conditions=?, weather=?, trail_conditions=?, notes=?, distance_mi=?,
           elevation_gain_ft=?, duration_min=?, route_type=?, other_lists=?, unmatched_peaks=?, external_id=?, updated_at=datetime('now')
           WHERE id = ?`
        )
        .run(...(cols as never[]), id)
      if (!res.changes) throw new HikeError("Hike not found", undefined, 404)
      d.prepare("DELETE FROM hike_peaks WHERE hike_id = ?").run(id)
    } else {
      id = Number(
        d
          .prepare(
            `INSERT INTO hikes (date, end_date, title, conditions, weather, trail_conditions, notes, distance_mi,
             elevation_gain_ft, duration_min, route_type, other_lists, unmatched_peaks, external_id, source, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          )
          .run(...(cols as never[]), opts.source ?? "web", opts.userId).lastInsertRowid
      )
      created = true
    }
    const addPeak = d.prepare("INSERT OR IGNORE INTO hike_peaks (hike_id, peak_id, ordinal) VALUES (?, ?, ?)")
    peakIds.forEach((pid, i) => addPeak.run(id!, pid, i))

    // participants: replace when given, default to caller's person on create
    let parts = data.participants
    if (!parts && created && opts.userPersonId) parts = [opts.userPersonId]
    if (parts) {
      d.prepare("DELETE FROM hike_participants WHERE hike_id = ?").run(id)
      const add = d.prepare(
        "INSERT OR REPLACE INTO hike_participants (hike_id, person_id, counts, note) VALUES (?, ?, ?, ?)"
      )
      for (const p of parts) {
        const ref = typeof p === "object" ? p.person : p
        const personId = resolvePerson(d, ref, opts.userId)
        const counts = typeof p === "object" && p.counts === false ? 0 : 1
        add.run(id, personId, counts, typeof p === "object" ? (p.note ?? null) : null)
      }
    }
    return { id: id!, created }
  })
  // Redlining: participants or the date may have changed, so refresh coverage from the hike's GPS track (if it has one).
  if (get("SELECT 1 FROM hike_tracks WHERE hike_id = ?", saved.id)) recomputeHikeCoverage(saved.id)
  return { hike: getHike(saved.id)!, peakMatches: matches, created: saved.created }
}

function resolvePerson(d: import("node:sqlite").DatabaseSync, ref: number | string, userId: number | null): number {
  if (typeof ref === "number") {
    const r = d.prepare("SELECT id FROM people WHERE id = ?").get(ref) as { id: number } | undefined
    if (!r) throw new HikeError(`Person ${ref} not found`, undefined, 422)
    return r.id
  }
  const name = ref.trim()
  if (/^\d+$/.test(name)) return resolvePerson(d, Number(name), userId)
  const r = d.prepare("SELECT id FROM people WHERE name = ? COLLATE NOCASE").get(name) as { id: number } | undefined
  if (r) return r.id
  return Number(d.prepare("INSERT INTO people (name, created_by) VALUES (?, ?)").run(name, userId).lastInsertRowid)
}

export function deleteHike(id: number): boolean {
  purgeHikeMedia(id)
  return tx((d) => d.prepare("DELETE FROM hikes WHERE id = ?").run(id).changes > 0)
}
