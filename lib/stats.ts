import "server-only"
import { all } from "./db"
import { allListsProgress, listLists, listProgress, listPeaks, type Mode } from "./progress"
import { todayLocal } from "./queries"
import { appTimeZone, isWinterHike, monthOf, seasonOf, winterSeasonYear, SEASONS, type Season } from "./seasons"

export const EVEREST_FT = 29032

type HikeRec = {
  id: number
  date: string
  end_date: string | null
  conditions: "snow" | "no_snow" | "mix" | null
  distance_mi: number | null
  elevation_gain_ft: number | null
  duration_min: number | null
}
type AscentRec = {
  hike_id: number
  date: string
  end_date: string | null
  peak_id: number
  name: string
  slug: string
  elevation_ft: number | null
  state: string | null
}

const DAY = 86400000
const dayNum = (d: string) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY)
const numToDate = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)
const weekIdx = (d: string) => Math.floor((dayNum(d) + 3) / 7) // Monday-based

function hikesFor(personId: number): HikeRec[] {
  return all<HikeRec>(
    `SELECT h.id, h.date, h.end_date, h.conditions, h.distance_mi, h.elevation_gain_ft, h.duration_min
     FROM hikes h JOIN hike_participants pa ON pa.hike_id = h.id AND pa.counts = 1 AND pa.person_id = ?
     ORDER BY h.date, h.id`,
    personId
  ).map((r) => ({ ...r }))
}

function ascentsFor(personId: number): AscentRec[] {
  return all<AscentRec>(
    `SELECT h.id hike_id, h.date, h.end_date, p.id peak_id, p.name, p.slug, p.elevation_ft, p.state
     FROM hike_peaks hp JOIN hikes h ON h.id = hp.hike_id
     JOIN hike_participants pa ON pa.hike_id = h.id AND pa.counts = 1 AND pa.person_id = ?
     JOIN peaks p ON p.id = hp.peak_id AND p.kind = 'peak' ORDER BY h.date, h.id`,
    personId
  ).map((r) => ({ ...r }))
}

/** Every calendar day a hike covers (multi-day trips span their range, capped at 14 days). */
function hikeDays(h: { date: string; end_date: string | null }): string[] {
  const start = dayNum(h.date)
  const end = h.end_date ? Math.min(dayNum(h.end_date), start + 13) : start
  const out: string[] = []
  for (let d = start; d <= Math.max(start, end); d++) out.push(numToDate(d))
  return out
}

const winterLabel = (y: number) => `${y}–${String((y + 1) % 100).padStart(2, "0")}`

export type Pace = {
  remaining: number
  total: number
  done: number
  perYear: number | null
  /** ISO date estimate (all-season) */
  etaDate: string | null
  /** winter: number of further winters needed and the winter label it would finish in */
  winters: number | null
  finishWinter: string | null
  sentence: string
}

export type BurnUp = {
  slug: string
  name: string
  shortName: string
  total: number
  all: { t: string; n: number }[]
  winter: { t: string; n: number }[]
  paceAll: Pace
  paceWinter: Pace
}

export type Core = {
  person: { id: number; name: string; color: string | null }
  kpis: {
    hikes: number
    uniquePeaks: number
    totalAscents: number
    miles: number
    milesHikes: number
    vertFt: number
    vertHikes: number
    daysOnTrail: number
    peaksThisYear: number
    peaksLastYear: number
    hikesThisYear: number
    hikesLastYear: number
  }
  years: number[]
  year: number
  byYear: { year: number; hikes: number; peaks: number; newPeaks: number; miles: number }[]
  byMonth: { year: number; counts: number[] }[]
  calendar: { date: string; count: number }[]
  yearSummary: { hikes: number; peaks: number; newPeaks: number; days: number; miles: number; vertFt: number; busiestMonth: string | null }
  seasonMix: Record<Season, number>
  conditionsMix: { snow: number; no_snow: number; mix: number; unknown: number }
  winterSeasons: { label: string; start: number; hikes: number; peaks: number; newPeaks: number }[]
  mostClimbed: { name: string; slug: string; count: number; elevationFt: number | null }[]
  highest: { name: string; slug: string; elevationFt: number; first: string }[]
  firstAscent: { date: string; peaks: string[] } | null
  lastAscent: { date: string; peaks: string[] } | null
  longestGap: { name: string; slug: string; last: string; days: number }[]
  partners: { id: number; name: string; color: string | null; hikes: number; together: number; bothDone: number; onlyMe: number; onlyThem: number; overlapPct: number }[]
  streaks: { longestWeekStreak: number; weekStreakEnd: string | null; currentWeekStreak: number; mostHikesInMonth: number; busiestMonthLabel: string | null; longestGapDays: number }
  burnUps: BurnUp[]
  closest: Record<"all" | "winter" | "season" | "grid", { slug: string; name: string; shortName: string; done: number; total: number; remaining: number; unit: "peaks" | "slots" }[]>
  gridLists: { slug: string; name: string; shortName: string; filled: number; slots: number; total: number; months: number[] }[]
  fun: {
    summitElevationFt: number
    everests: number
    everestBasis: "vert" | "summits"
    states: string[]
    highestPeak: { name: string; elevationFt: number } | null
  }
}

function paceFor(args: { remaining: number; total: number; done: number; perYear: number | null; today: string; winterPace?: number | null; name: string; winter?: boolean }): Pace {
  const { remaining, total, done, today, name } = args
  if (remaining <= 0) return { remaining, total, done, perYear: args.perYear, etaDate: null, winters: 0, finishWinter: null, sentence: `Finished: all ${total} done.` }
  if (args.winter) {
    const wp = args.winterPace
    if (!wp || wp <= 0) return { remaining, total, done, perYear: null, etaDate: null, winters: null, finishWinter: null, sentence: `${remaining} still to go in winter. Not enough recent winter progress to project a finish.` }
    const winters = Math.ceil(remaining / wp)
    const tzNow = winterSeasonYear(today, appTimeZone())
    const next = tzNow ?? Number(today.slice(0, 4)) // winter that starts this December, or the current one
    const finish = winterLabel(next + winters - 1)
    return {
      remaining, total, done, perYear: wp, etaDate: null, winters, finishWinter: finish,
      sentence: `At your winter pace (${wp.toFixed(1)} peaks a winter) you'd finish ${name} in about ${winters} more winter${winters === 1 ? "" : "s"}, around ${finish}.`,
    }
  }
  const py = args.perYear
  if (!py || py <= 0) return { remaining, total, done, perYear: null, etaDate: null, winters: null, finishWinter: null, sentence: `${remaining} to go. Not enough recent progress to project a finish.` }
  const yrs = remaining / py
  const eta = numToDate(dayNum(today) + Math.round(yrs * 365))
  return {
    remaining, total, done, perYear: py, etaDate: eta, winters: null, finishWinter: null,
    sentence: `At your recent pace (${py.toFixed(1)} peaks a year) you'd finish ${name} around ${eta.slice(0, 4)}.`,
  }
}

export function computeCore(personId: number, opts: { year?: number | null } = {}): Core | null {
  const pr = all<{ id: number; name: string; color: string | null }>("SELECT id, name, color FROM people WHERE id = ?", personId)[0]
  if (!pr) return null
  const person = { ...pr }
  const tz = appTimeZone()
  const today = todayLocal()
  const thisYear = Number(today.slice(0, 4))
  const hikes = hikesFor(personId)
  const asc = ascentsFor(personId)

  const years = [...new Set(hikes.map((h) => Number(h.date.slice(0, 4))))].sort((a, b) => a - b)
  const year = opts.year && years.includes(opts.year) ? opts.year : years.includes(thisYear) ? thisYear : (years[years.length - 1] ?? thisYear)

  // ---- peak-level aggregation
  type PeakAgg = { name: string; slug: string; elev: number | null; state: string | null; hikeIds: Set<number>; first: string; last: string; firstYear: number }
  const peaks = new Map<number, PeakAgg>()
  const peaksByYear = new Map<number, Set<number>>()
  for (const a of asc) {
    const y = Number(a.date.slice(0, 4))
    let p = peaks.get(a.peak_id)
    if (!p) peaks.set(a.peak_id, (p = { name: a.name, slug: a.slug, elev: a.elevation_ft, state: a.state, hikeIds: new Set(), first: a.date, last: a.date, firstYear: y }))
    p.hikeIds.add(a.hike_id)
    p.last = a.date
    ;(peaksByYear.get(y) ?? peaksByYear.set(y, new Set()).get(y)!).add(a.peak_id)
  }

  // ---- KPIs
  const dayset = new Set<string>()
  let miles = 0, milesHikes = 0, vert = 0, vertHikes = 0
  for (const h of hikes) {
    for (const d of hikeDays(h)) dayset.add(d)
    if (h.distance_mi) { miles += h.distance_mi; milesHikes++ }
    if (h.elevation_gain_ft) { vert += h.elevation_gain_ft; vertHikes++ }
  }
  const hikesIn = (y: number) => hikes.filter((h) => h.date.startsWith(String(y)))
  const kpis = {
    hikes: hikes.length,
    uniquePeaks: peaks.size,
    totalAscents: asc.length,
    miles: Math.round(miles * 10) / 10,
    milesHikes,
    vertFt: Math.round(vert),
    vertHikes,
    daysOnTrail: dayset.size,
    peaksThisYear: peaksByYear.get(thisYear)?.size ?? 0,
    peaksLastYear: peaksByYear.get(thisYear - 1)?.size ?? 0,
    hikesThisYear: hikesIn(thisYear).length,
    hikesLastYear: hikesIn(thisYear - 1).length,
  }

  // ---- per year + month heatmap
  const spanYears = years.length ? Array.from({ length: years[years.length - 1] - years[0] + 1 }, (_, i) => years[0] + i) : []
  const byYear = spanYears.map((y) => {
    const hs = hikesIn(y)
    return {
      year: y,
      hikes: hs.length,
      peaks: peaksByYear.get(y)?.size ?? 0,
      newPeaks: [...peaks.values()].filter((p) => p.firstYear === y).length,
      miles: Math.round(hs.reduce((a, h) => a + (h.distance_mi ?? 0), 0) * 10) / 10,
    }
  })
  const byMonth = spanYears.map((y) => {
    const counts = Array(12).fill(0) as number[]
    for (const h of hikesIn(y)) counts[monthOf(h.date) - 1]++
    return { year: y, counts }
  })

  // ---- calendar for selected year
  const cal = new Map<string, number>()
  for (const h of hikes) for (const d of hikeDays(h)) if (d.startsWith(String(year))) cal.set(d, (cal.get(d) ?? 0) + 1)
  const calendar = [...cal].map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? -1 : 1))
  const ysHikes = hikesIn(year)
  const monthCounts = byMonth.find((m) => m.year === year)?.counts ?? Array(12).fill(0)
  const maxM = Math.max(...monthCounts)
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  const yearSummary = {
    hikes: ysHikes.length,
    peaks: peaksByYear.get(year)?.size ?? 0,
    newPeaks: [...peaks.values()].filter((p) => p.firstYear === year).length,
    days: calendar.length,
    miles: Math.round(ysHikes.reduce((a, h) => a + (h.distance_mi ?? 0), 0) * 10) / 10,
    vertFt: Math.round(ysHikes.reduce((a, h) => a + (h.elevation_gain_ft ?? 0), 0)),
    busiestMonth: maxM > 0 ? MONTHS[monthCounts.indexOf(maxM)] : null,
  }

  // ---- mixes
  const seasonMix = Object.fromEntries(SEASONS.map((s) => [s, 0])) as Record<Season, number>
  const conditionsMix = { snow: 0, no_snow: 0, mix: 0, unknown: 0 }
  for (const h of hikes) {
    seasonMix[seasonOf(h.date, tz)]++
    conditionsMix[h.conditions ?? "unknown"]++
  }

  // ---- winter seasons (valid winter ascents only), including empty winters in between
  const wMap = new Map<number, { hikes: Set<number>; peaks: Set<number> }>()
  for (const h of hikes) {
    if (!isWinterHike(h.date, h.end_date, tz)) continue
    const w = winterSeasonYear(h.date, tz)!
    ;(wMap.get(w) ?? wMap.set(w, { hikes: new Set(), peaks: new Set() }).get(w)!).hikes.add(h.id)
  }
  const firstWinterOfPeak = new Map<number, number>()
  for (const a of asc) {
    if (!isWinterHike(a.date, a.end_date, tz)) continue
    const w = winterSeasonYear(a.date, tz)!
    wMap.get(w)?.peaks.add(a.peak_id)
    if (!firstWinterOfPeak.has(a.peak_id)) firstWinterOfPeak.set(a.peak_id, w)
  }
  const wKeys = [...wMap.keys()].sort((a, b) => a - b)
  const winterSeasons = wKeys.length
    ? Array.from({ length: wKeys[wKeys.length - 1] - wKeys[0] + 1 }, (_, i) => wKeys[0] + i).map((w) => ({
        label: winterLabel(w),
        start: w,
        hikes: wMap.get(w)?.hikes.size ?? 0,
        peaks: wMap.get(w)?.peaks.size ?? 0,
        newPeaks: [...firstWinterOfPeak.values()].filter((x) => x === w).length,
      }))
    : []

  // ---- peak rankings
  const plist = [...peaks.entries()].map(([id, p]) => ({ id, ...p }))
  const mostClimbed = plist
    .map((p) => ({ name: p.name, slug: p.slug, count: p.hikeIds.size, elevationFt: p.elev }))
    .sort((a, b) => b.count - a.count || (b.elevationFt ?? 0) - (a.elevationFt ?? 0))
    .slice(0, 6)
  const highest = plist
    .filter((p) => p.elev)
    .sort((a, b) => b.elev! - a.elev!)
    .slice(0, 6)
    .map((p) => ({ name: p.name, slug: p.slug, elevationFt: p.elev!, first: p.first }))
  const hikesWithPeaks = new Map<number, { date: string; names: string[] }>()
  for (const a of asc) (hikesWithPeaks.get(a.hike_id) ?? hikesWithPeaks.set(a.hike_id, { date: a.date, names: [] }).get(a.hike_id)!).names.push(a.name)
  const hp = [...hikesWithPeaks.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  const firstAscent = hp.length ? { date: hp[0].date, peaks: hp[0].names } : null
  const lastAscent = hp.length ? { date: hp[hp.length - 1].date, peaks: hp[hp.length - 1].names } : null
  const longestGap = plist
    .map((p) => ({ name: p.name, slug: p.slug, last: p.last, days: dayNum(today) - dayNum(p.last) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 5)

  // ---- partners
  const partnerRows = all<{ person_id: number; name: string; color: string | null; hikes: number }>(
    `SELECT o.person_id, p.name, p.color, COUNT(DISTINCT o.hike_id) hikes
     FROM hike_participants me JOIN hike_participants o ON o.hike_id = me.hike_id AND o.person_id <> me.person_id
     JOIN people p ON p.id = o.person_id WHERE me.person_id = ? AND me.counts = 1 AND o.counts = 1
     GROUP BY o.person_id ORDER BY hikes DESC, p.name LIMIT 12`,
    personId
  )
  const partners = partnerRows.map((r) => {
    const together = all<{ n: number }>(
      `SELECT COUNT(DISTINCT hp.peak_id) n FROM hike_peaks hp
       JOIN hike_participants a ON a.hike_id = hp.hike_id AND a.person_id = ? AND a.counts = 1
       JOIN hike_participants b ON b.hike_id = hp.hike_id AND b.person_id = ? AND b.counts = 1`,
      personId, r.person_id
    )[0].n
    const theirs = new Set(ascentsFor(r.person_id).map((a) => a.peak_id))
    let both = 0
    for (const id of peaks.keys()) if (theirs.has(id)) both++
    const union = peaks.size + theirs.size - both
    return {
      id: r.person_id, name: r.name, color: r.color, hikes: r.hikes, together, bothDone: both,
      onlyMe: peaks.size - both, onlyThem: theirs.size - both,
      overlapPct: union ? Math.round((both / union) * 100) : 0,
    }
  })

  // ---- streaks
  const weeks = [...new Set(hikes.flatMap((h) => hikeDays(h)).map(weekIdx))].sort((a, b) => a - b)
  let best = 0, bestEnd = 0, run = 0
  weeks.forEach((w, i) => {
    run = i > 0 && w === weeks[i - 1] + 1 ? run + 1 : 1
    if (run > best) { best = run; bestEnd = w }
  })
  const nowW = weekIdx(today)
  let current = 0
  if (weeks.length) {
    let w = weeks.includes(nowW) ? nowW : weeks.includes(nowW - 1) ? nowW - 1 : -1
    while (w >= 0 && weeks.includes(w)) { current++; w-- }
  }
  const perMonth = new Map<string, number>()
  for (const h of hikes) perMonth.set(h.date.slice(0, 7), (perMonth.get(h.date.slice(0, 7)) ?? 0) + 1)
  const topMonth = [...perMonth].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0]
  const sortedDays = [...dayset].sort()
  let maxGap = 0
  for (let i = 1; i < sortedDays.length; i++) maxGap = Math.max(maxGap, dayNum(sortedDays[i]) - dayNum(sortedDays[i - 1]))
  const streaks = {
    longestWeekStreak: best,
    weekStreakEnd: best ? numToDate(bestEnd * 7 - 3 + 6) : null,
    currentWeekStreak: current,
    mostHikesInMonth: topMonth?.[1] ?? 0,
    busiestMonthLabel: topMonth ? `${MONTHS[+topMonth[0].slice(5) - 1]} ${topMonth[0].slice(0, 4)}` : null,
    longestGapDays: maxGap,
  }

  // ---- lists: burn-ups, closest, grid
  const lists = listLists()
  const allProg = allListsProgress(personId, "all")
  const listPeakIds = new Map<number, Set<number>>()
  for (const l of lists) listPeakIds.set(l.id, new Set(listPeaks(l.id).map((p) => p.id)))
  const curWinter = winterSeasonYear(today, tz)
  const lastFullWinters = curWinter !== null ? [curWinter - 1, curWinter] : [thisYear - 2, thisYear - 1]
  const burnUps: BurnUp[] = []
  for (const r of allProg.filter((r) => r.credits > 0)) {
    const ids = listPeakIds.get(r.list.id)!
    const firstAll = new Map<number, string>()
    const firstWin = new Map<number, string>()
    for (const a of asc) {
      if (!ids.has(a.peak_id)) continue
      if (!firstAll.has(a.peak_id)) firstAll.set(a.peak_id, a.date)
      if (!firstWin.has(a.peak_id) && isWinterHike(a.date, a.end_date, tz)) firstWin.set(a.peak_id, a.date)
    }
    const series = (m: Map<number, string>) => {
      const dates = [...m.values()].sort()
      const pts: { t: string; n: number }[] = []
      dates.forEach((d, i) => {
        if (pts.length && pts[pts.length - 1].t === d) pts[pts.length - 1].n = i + 1
        else pts.push({ t: d, n: i + 1 })
      })
      return pts
    }
    const sAll = series(firstAll)
    const sWin = series(firstWin)
    const total = r.total
    const yearAgo = numToDate(dayNum(today) - 365)
    let recent = [...firstAll.values()].filter((d) => d > yearAgo).length
    if (!recent && sAll.length) {
      const span = Math.max(1, (dayNum(today) - dayNum(sAll[0].t)) / 365)
      recent = sAll[sAll.length - 1].n / span
    }
    const winterPeaks = [...firstWin.values()].map((d) => winterSeasonYear(d, tz)!)
    const wPace = winterPeaks.length ? lastFullWinters.reduce((a, w) => a + winterPeaks.filter((x) => x === w).length, 0) / lastFullWinters.length : 0
    const short = r.list.short_name ?? r.list.name
    burnUps.push({
      slug: r.list.slug,
      name: r.list.name,
      shortName: short,
      total,
      all: sAll,
      winter: sWin,
      paceAll: paceFor({ remaining: total - firstAll.size, total, done: firstAll.size, perYear: recent || null, today, name: short }),
      paceWinter: paceFor({ remaining: total - firstWin.size, total, done: firstWin.size, perYear: null, today, name: short, winter: true, winterPace: wPace }),
    })
  }
  burnUps.sort((a, b) => b.all.length && a.all.length ? (b.all[b.all.length - 1].n / b.total) - (a.all[a.all.length - 1].n / a.total) : 0)

  const closest = {} as Core["closest"]
  for (const mode of ["all", "winter", "season", "grid"] as const) {
    const prog = mode === "all" ? allProg : allListsProgress(personId, mode as Mode)
    const slots = mode === "season" || mode === "grid"
    closest[mode] = prog
      .filter((r) => r.credits > 0)
      .map((r) => {
        const done = slots ? r.credits : r.completed
        const total = slots ? r.creditsTotal : r.total
        return { slug: r.list.slug, name: r.list.name, shortName: r.list.short_name ?? r.list.name, done, total, remaining: total - done, unit: (slots ? "slots" : "peaks") as "peaks" | "slots" }
      })
      .sort((a, b) => a.remaining - b.remaining || b.total - a.total)
      .slice(0, 8)
  }

  const gridLists: Core["gridLists"] = []
  for (const r of allListsProgress(personId, "grid").filter((r) => r.credits > 0).sort((a, b) => b.credits / b.creditsTotal - a.credits / a.creditsTotal).slice(0, 6)) {
    const lp = listProgress(r.list.slug, personId, "grid")
    if (!lp) continue
    const months = Array(12).fill(0) as number[]
    for (const p of lp.peaks) for (const m of p.status.months) months[m - 1]++
    gridLists.push({ slug: r.list.slug, name: r.list.name, shortName: r.list.short_name ?? r.list.name, filled: r.credits, slots: r.creditsTotal, total: r.total, months })
  }

  // ---- fun facts
  const summitSum = plist.reduce((a, p) => a + (p.elev ?? 0), 0)
  const topPeak = highest[0]
  const fun = {
    summitElevationFt: summitSum,
    everests: Math.round(((vertHikes ? vert : summitSum) / EVEREST_FT) * 10) / 10,
    everestBasis: (vertHikes ? "vert" : "summits") as "vert" | "summits",
    states: [...new Set(plist.map((p) => p.state).filter((s): s is string => !!s))].sort(),
    highestPeak: topPeak ? { name: topPeak.name, elevationFt: topPeak.elevationFt } : null,
  }

  return {
    person, kpis, years, year, byYear, byMonth, calendar, yearSummary, seasonMix, conditionsMix, winterSeasons,
    mostClimbed, highest, firstAscent, lastAscent, longestGap, partners, streaks, burnUps, closest, gridLists, fun,
  }
}

export type Stats = { today: string; core: Core; compare: Core | null }

export function getStats(opts: { personId: number; withId?: number | null; year?: number | null }): Stats | null {
  const core = computeCore(opts.personId, { year: opts.year })
  if (!core) return null
  const compare = opts.withId && opts.withId !== opts.personId ? computeCore(opts.withId, { year: core.year }) : null
  return { today: todayLocal(), core, compare }
}

/** Small summary for the dashboard widgets. */
export function dashboardHighlights(personId: number) {
  const c = computeCore(personId)
  if (!c) return null
  const nextUp = c.closest.all.find((x) => x.remaining > 0) ?? null
  return {
    peaksThisYear: c.kpis.peaksThisYear,
    peaksLastYear: c.kpis.peaksLastYear,
    hikesThisYear: c.kpis.hikesThisYear,
    nextUp,
    topPartner: c.partners[0] ?? null,
    currentWeekStreak: c.streaks.currentWeekStreak,
    longestWeekStreak: c.streaks.longestWeekStreak,
    uniquePeaks: c.kpis.uniquePeaks,
  }
}
