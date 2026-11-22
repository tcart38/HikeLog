import "server-only"
import { all, get } from "./db"
import { appTimeZone, isWinterHike, monthOf, seasonOf, type Season } from "./seasons"

/**
 * Tracking modes, per peakbagging convention:
 * - all:     any ascent (the "regular" list)
 * - winter:  astronomical winter, start and end inside the same winter
 * - season:  "four-season": the peak in each of winter, spring, summer, fall
 * - grid:    the peak in each of the 12 calendar months
 * - snow / no_snow / mix: by recorded conditions (Alex's spreadsheet tracks these)
 * Spring/summer/fall singles are also accepted ("spring" etc.) for "has this peak been done in X".
 */
export type Mode = "all" | "winter" | "spring" | "summer" | "fall" | "season" | "grid" | "snow" | "no_snow" | "mix"
export const MODES: Mode[] = ["all", "winter", "spring", "summer", "fall", "season", "grid", "snow", "no_snow", "mix"]

export type ListRow = {
  id: number
  slug: string
  name: string
  short_name: string | null
  region: string | null
  description: string | null
  criteria: string | null
  organization: string | null
  official_url: string | null
  notes: string | null
  sources_json: string
  is_custom: number
  peak_count: number
}

export function listLists(): ListRow[] {
  return all<ListRow>(
    `SELECT l.*, (SELECT COUNT(*) FROM list_peaks lp WHERE lp.list_id = l.id) peak_count
     FROM lists l ORDER BY l.region, l.name`
  )
}
export function getList(slug: string): ListRow | undefined {
  return get<ListRow>(
    `SELECT l.*, (SELECT COUNT(*) FROM list_peaks lp WHERE lp.list_id = l.id) peak_count FROM lists l WHERE l.slug = ?`,
    slug
  )
}

export type ListPeak = {
  id: number
  slug: string
  name: string
  elevation_ft: number | null
  state: string | null
  range: string | null
  lat: number | null
  lon: number | null
  rank: number | null
  notes: string | null
}
export function listPeaks(listId: number): ListPeak[] {
  return all<ListPeak>(
    `SELECT p.id, p.slug, p.name, p.elevation_ft, p.state, p.range, p.lat, p.lon, lp.rank, lp.notes
     FROM list_peaks lp JOIN peaks p ON p.id = lp.peak_id WHERE lp.list_id = ? ORDER BY lp.rank, p.elevation_ft DESC`,
    listId
  )
}

type Ascent = { peak_id: number; person_id: number; hike_id: number; date: string; end_date: string | null; conditions: string | null }

function ascents(personIds: number[], peakIds?: number[]): Ascent[] {
  if (!personIds.length) return []
  const pp = personIds.map(() => "?").join(",")
  let sql = `SELECT hp.peak_id, pa.person_id, h.id hike_id, h.date, h.end_date, h.conditions
     FROM hike_peaks hp JOIN hikes h ON h.id = hp.hike_id
     JOIN hike_participants pa ON pa.hike_id = h.id AND pa.counts = 1
     WHERE pa.person_id IN (${pp})`
  const params: unknown[] = [...personIds]
  if (peakIds) {
    if (!peakIds.length) return []
    sql += ` AND hp.peak_id IN (${peakIds.map(() => "?").join(",")})`
    params.push(...peakIds)
  }
  return all<Ascent>(sql + " ORDER BY h.date", ...params)
}

/** Per person+peak summary of everything needed for every mode. */
export type PeakStatus = {
  count: number
  first: string | null
  last: string | null
  firstWinter: string | null
  seasons: Season[]
  months: number[]
  conditions: ("snow" | "no_snow" | "mix")[]
  hikeIds: number[]
}

function emptyStatus(): PeakStatus {
  return { count: 0, first: null, last: null, firstWinter: null, seasons: [], months: [], conditions: [], hikeIds: [] }
}

function summarize(rows: Ascent[]): Map<string, PeakStatus> {
  const tz = appTimeZone()
  const out = new Map<string, PeakStatus>()
  for (const a of rows) {
    const k = `${a.person_id}:${a.peak_id}`
    let s = out.get(k)
    if (!s) out.set(k, (s = emptyStatus()))
    s.count++
    s.first ??= a.date
    s.last = a.date
    s.hikeIds.push(a.hike_id)
    if (isWinterHike(a.date, a.end_date, tz)) s.firstWinter ??= a.date
    const season = seasonOf(a.date, tz)
    if (!s.seasons.includes(season)) s.seasons.push(season)
    const m = monthOf(a.date)
    if (!s.months.includes(m)) s.months.push(m)
    if (a.conditions && !s.conditions.includes(a.conditions as never)) s.conditions.push(a.conditions as never)
  }
  for (const s of out.values()) s.months.sort((a, b) => a - b)
  return out
}

/** Units of credit a mode needs per peak (season=4, grid=12, else 1). */
export function unitsFor(mode: Mode): number {
  return mode === "season" ? 4 : mode === "grid" ? 12 : 1
}

/** Credits earned for one peak in a mode (0..unitsFor(mode)). */
export function creditFor(s: PeakStatus | undefined, mode: Mode): number {
  if (!s || !s.count) return 0
  switch (mode) {
    case "all":
      return 1
    case "winter":
      return s.firstWinter ? 1 : 0
    case "spring":
    case "summer":
    case "fall":
      return s.seasons.includes(mode) ? 1 : 0
    case "season":
      // winter slot requires a valid winter hike, not just a date in winter
      return s.seasons.filter((x) => x !== "winter").length + (s.firstWinter ? 1 : 0)
    case "grid":
      return s.months.length
    case "snow":
    case "no_snow":
    case "mix":
      return s.conditions.includes(mode) ? 1 : 0
  }
}

export type ListProgress = {
  list: ListRow
  mode: Mode
  personId: number
  peaks: (ListPeak & { status: PeakStatus; credit: number; done: boolean })[]
  completed: number // peaks fully done for the mode
  total: number
  credits: number // sum of credits (season/grid)
  creditsTotal: number
}

export function listProgress(slug: string, personId: number, mode: Mode = "all"): ListProgress | null {
  const list = getList(slug)
  if (!list) return null
  const peaks = listPeaks(list.id)
  const sum = summarize(ascents([personId], peaks.map((p) => p.id)))
  const units = unitsFor(mode)
  const rows = peaks.map((p) => {
    const status = sum.get(`${personId}:${p.id}`) ?? emptyStatus()
    const credit = creditFor(status, mode)
    return { ...p, status, credit, done: credit >= units }
  })
  return {
    list,
    mode,
    personId,
    peaks: rows,
    completed: rows.filter((r) => r.done).length,
    total: rows.length,
    credits: rows.reduce((a, r) => a + r.credit, 0),
    creditsTotal: rows.length * units,
  }
}

/** Progress summary across every list for a person, for dashboards. */
export function allListsProgress(personId: number, mode: Mode = "all") {
  const lists = listLists()
  const memberships = all<{ list_id: number; peak_id: number }>("SELECT list_id, peak_id FROM list_peaks")
  const sum = summarize(ascents([personId]))
  const units = unitsFor(mode)
  return lists.map((l) => {
    const ids = memberships.filter((m) => m.list_id === l.id).map((m) => m.peak_id)
    let completed = 0
    let credits = 0
    for (const id of ids) {
      const c = creditFor(sum.get(`${personId}:${id}`), mode)
      credits += c
      if (c >= units) completed++
    }
    return { list: l, completed, total: ids.length, credits, creditsTotal: ids.length * units }
  })
}

export type CompareRow = ListPeak & {
  byPerson: Record<number, { status: PeakStatus; credit: number; done: boolean }>
  /** For grid/season: which units (months 1-12 or seasons) nobody / everybody still needs */
  missingFor: number[] // person ids who still need it
}

/**
 * Compare N people on one list in one mode.
 * Buckets: everyone done, some done (per-person remaining), nobody done ("all still need").
 */
export function compare(slug: string, personIds: number[], mode: Mode = "all") {
  const list = getList(slug)
  if (!list) return null
  const peaks = listPeaks(list.id)
  const sum = summarize(ascents(personIds, peaks.map((p) => p.id)))
  const units = unitsFor(mode)
  const rows: CompareRow[] = peaks.map((p) => {
    const byPerson: CompareRow["byPerson"] = {}
    for (const pid of personIds) {
      const status = sum.get(`${pid}:${p.id}`) ?? emptyStatus()
      const credit = creditFor(status, mode)
      byPerson[pid] = { status, credit, done: credit >= units }
    }
    return { ...p, byPerson, missingFor: personIds.filter((pid) => !byPerson[pid].done) }
  })
  const n = personIds.length
  return {
    list,
    mode,
    personIds,
    peaks: rows,
    summary: {
      total: rows.length,
      allDone: rows.filter((r) => r.missingFor.length === 0).length,
      allNeed: rows.filter((r) => r.missingFor.length === n).length,
      perPerson: Object.fromEntries(
        personIds.map((pid) => [
          pid,
          {
            done: rows.filter((r) => r.byPerson[pid].done).length,
            remaining: rows.filter((r) => !r.byPerson[pid].done).length,
            onlyThem: rows.filter((r) => r.byPerson[pid].done && r.missingFor.length > 0).length,
            onlyTheyNeed: rows.filter((r) => r.missingFor.length === 1 && r.missingFor[0] === pid).length,
          },
        ])
      ),
    },
  }
}
