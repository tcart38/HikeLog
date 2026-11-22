import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { all, get } from "./db"
import { currentUser, userCount, type User } from "./auth"
import { appTimeZone, isWinterHike, monthOf, seasonOf, type Season } from "./seasons"

// ---------- session guards ----------
export const getUser = cache(currentUser)

/** For pages inside (app): redirect to /setup or /login when there is no session. */
export async function requireUser(): Promise<User> {
  const u = await getUser()
  if (!u) redirect(userCount() === 0 ? "/setup" : "/login")
  return u
}

// ---------- people ----------
export type PersonRow = {
  id: number
  name: string
  color: string | null
  username: string | null
  user_id: number | null
  hikes: number
  last_hike: string | null
}

export function listPeople(): PersonRow[] {
  // node:sqlite rows have a null prototype; spread so they can cross into client components.
  return all<PersonRow>(
    `SELECT p.id, p.name, p.color,
      (SELECT u.username FROM users u WHERE u.person_id = p.id) username,
      (SELECT u.id FROM users u WHERE u.person_id = p.id) user_id,
      (SELECT COUNT(*) FROM hike_participants hp WHERE hp.person_id = p.id) hikes,
      (SELECT MAX(h.date) FROM hike_participants hp JOIN hikes h ON h.id = hp.hike_id WHERE hp.person_id = p.id) last_hike
     FROM people p ORDER BY (user_id IS NULL), p.name COLLATE NOCASE`
  ).map((r) => ({ ...r }))
}

export function hikeCount(): number {
  return get<{ n: number }>("SELECT COUNT(*) n FROM hikes")!.n
}

// ---------- peaks ----------
export type PeakOption = {
  id: number
  name: string
  elevationFt: number | null
  state: string | null
  lists: string[] // list slugs
}

/** Every peak with the lists it belongs to, for the hike-form picker. */
export function peakOptions(): PeakOption[] {
  const peaks = all<{ id: number; name: string; elevation_ft: number | null; state: string | null }>(
    "SELECT id, name, elevation_ft, state FROM peaks ORDER BY elevation_ft DESC, name"
  )
  const mem = all<{ peak_id: number; slug: string }>(
    "SELECT lp.peak_id, l.slug FROM list_peaks lp JOIN lists l ON l.id = lp.list_id"
  )
  const by = new Map<number, string[]>()
  for (const m of mem) (by.get(m.peak_id) ?? by.set(m.peak_id, []).get(m.peak_id)!).push(m.slug)
  return peaks.map((p) => ({ id: p.id, name: p.name, elevationFt: p.elevation_ft, state: p.state, lists: by.get(p.id) ?? [] }))
}

export type PeakDetail = {
  id: number
  slug: string
  name: string
  elevation_ft: number | null
  state: string | null
  range: string | null
  lat: number | null
  lon: number | null
  notes: string | null
}

export function getPeak(slug: string): PeakDetail | undefined {
  return get<PeakDetail>("SELECT id, slug, name, elevation_ft, state, range, lat, lon, notes FROM peaks WHERE slug = ?", slug)
}

export function peakLists(peakId: number) {
  return all<{ slug: string; name: string; short_name: string | null; rank: number | null }>(
    `SELECT l.slug, l.name, l.short_name, lp.rank FROM list_peaks lp JOIN lists l ON l.id = lp.list_id
     WHERE lp.peak_id = ? ORDER BY l.name`,
    peakId
  )
}

// ---------- per-cell ascents (which hike filled a month / season / condition) ----------
export type PeakCells = {
  first: number | null // hike ids
  last: number | null
  winter: number | null
  seasons: Partial<Record<Season, number>>
  months: Record<number, number>
  conditions: Partial<Record<"snow" | "no_snow" | "mix", number>>
  firstDate: string | null
  lastDate: string | null
  winterDate: string | null
}

/** For one list and person: the earliest hike that fills each cell, so matrix cells can link to it. */
export function peakCells(listSlug: string, personId: number): Map<number, PeakCells> {
  const rows = all<{ peak_id: number; hike_id: number; date: string; end_date: string | null; conditions: string | null }>(
    `SELECT hp.peak_id, h.id hike_id, h.date, h.end_date, h.conditions
     FROM list_peaks lp JOIN lists l ON l.id = lp.list_id AND l.slug = ?
     JOIN hike_peaks hp ON hp.peak_id = lp.peak_id
     JOIN hikes h ON h.id = hp.hike_id
     JOIN hike_participants pa ON pa.hike_id = h.id AND pa.counts = 1 AND pa.person_id = ?
     ORDER BY h.date, h.id`,
    listSlug,
    personId
  )
  const tz = appTimeZone()
  const out = new Map<number, PeakCells>()
  for (const r of rows) {
    let c = out.get(r.peak_id)
    if (!c) {
      c = { first: null, last: null, winter: null, seasons: {}, months: {}, conditions: {}, firstDate: null, lastDate: null, winterDate: null }
      out.set(r.peak_id, c)
    }
    c.first ??= r.hike_id
    c.firstDate ??= r.date
    c.last = r.hike_id
    c.lastDate = r.date
    const season = seasonOf(r.date, tz)
    if (isWinterHike(r.date, r.end_date, tz)) {
      c.winter ??= r.hike_id
      c.winterDate ??= r.date
    }
    // The four-season winter slot needs a valid winter hike; other seasons use the start date.
    if (season !== "winter") c.seasons[season] ??= r.hike_id
    else if (isWinterHike(r.date, r.end_date, tz)) c.seasons.winter ??= r.hike_id
    const m = monthOf(r.date)
    c.months[m] ??= r.hike_id
    if (r.conditions) c.conditions[r.conditions as "snow"] ??= r.hike_id
  }
  return out
}

/** Lists a hike credits, with how many of its peaks are on each. */
export function hikeLists(hikeId: number) {
  return all<{ slug: string; name: string; short_name: string | null; n: number }>(
    `SELECT l.slug, l.name, l.short_name, COUNT(*) n
     FROM hike_peaks hp JOIN list_peaks lp ON lp.peak_id = hp.peak_id JOIN lists l ON l.id = lp.list_id
     WHERE hp.hike_id = ? GROUP BY l.id ORDER BY n DESC, l.name`,
    hikeId
  )
}

/** Today's date (YYYY-MM-DD) in the app's time zone, for form defaults. */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: appTimeZone(), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}
