import "server-only"
import { all } from "../db"
import { levenshtein, normalizePeakName, splitPeakNames } from "./normalize"

export type PeakRow = {
  id: number
  slug: string
  name: string
  elevation_ft: number | null
  state: string | null
  range: string | null
  lat: number | null
  lon: number | null
}

export type MatchResult =
  | { input: string; status: "matched"; peak: PeakRow; via: "exact" | "fuzzy" | "context" }
  | { input: string; status: "ambiguous"; candidates: PeakRow[] }
  | { input: string; status: "unmatched"; suggestions: PeakRow[] }

type AliasRow = PeakRow & { alias: string }

let aliasCache: { at: number; rows: AliasRow[] } | null = null
function aliasRows(): AliasRow[] {
  if (aliasCache && Date.now() - aliasCache.at < 30_000) return aliasCache.rows
  const rows = all<AliasRow>(
    `SELECT p.id, p.slug, p.name, p.elevation_ft, p.state, p.range, p.lat, p.lon, a.alias
     FROM peak_aliases a JOIN peaks p ON p.id = a.peak_id`
  )
  aliasCache = { at: Date.now(), rows }
  return rows
}
export function invalidatePeakCache() {
  aliasCache = null
  statesCache = null
}

function uniq(rows: PeakRow[]): PeakRow[] {
  const m = new Map<number, PeakRow>()
  for (const r of rows) {
    const { alias: _a, ...p } = r as AliasRow
    void _a
    m.set(r.id, p)
  }
  return [...m.values()]
}

export type MatchContext = {
  /** Prefer peaks in this state (2-letter) when a name is ambiguous. */
  state?: string | null
  /** Prefer peaks on this list (slug) when ambiguous. */
  listSlug?: string | null
  /** Peak ids already matched in the same hike; their states break ties. */
  siblingStates?: string[]
}

function listPeakIds(slug: string): Set<number> {
  return new Set(
    all<{ peak_id: number }>(
      "SELECT lp.peak_id FROM list_peaks lp JOIN lists l ON l.id = lp.list_id WHERE l.slug = ?",
      slug
    ).map((r) => r.peak_id)
  )
}

/** Match one free-text peak name (or a peak slug / numeric id) to a peak. */
export function matchPeak(input: string, ctx: MatchContext = {}): MatchResult {
  const raw = input.trim()
  const rows = aliasRows()
  // slug or id
  const bySlug = rows.find((r) => r.slug === raw.toLowerCase())
  if (bySlug) return { input, status: "matched", peak: uniq([bySlug])[0], via: "exact" }
  if (/^\d+$/.test(raw)) {
    const byId = rows.find((r) => r.id === Number(raw))
    if (byId) return { input, status: "matched", peak: uniq([byId])[0], via: "exact" }
  }

  const n = normalizePeakName(raw)
  if (!n) return { input, status: "unmatched", suggestions: [] }
  let candidates = uniq(rows.filter((r) => r.alias === n))
  let via: "exact" | "fuzzy" = "exact"
  if (!candidates.length && n.length >= 5) {
    const scored = rows
      .map((r) => ({ r, d: levenshtein(n, r.alias) }))
      .filter((x) => x.d <= (n.length >= 9 ? 2 : 1))
      .sort((a, b) => a.d - b.d)
    if (scored.length) {
      const best = scored[0].d
      candidates = uniq(scored.filter((x) => x.d === best).map((x) => x.r))
      via = "fuzzy"
    }
  }
  if (candidates.length === 1) return { input, status: "matched", peak: candidates[0], via }
  if (candidates.length > 1) {
    const narrowed = disambiguate(candidates, ctx)
    if (narrowed) return { input, status: "matched", peak: narrowed, via: "context" }
    return { input, status: "ambiguous", candidates }
  }
  const suggestions = uniq(
    rows
      .filter((r) => r.alias.includes(n) || n.includes(r.alias))
      .slice(0, 50)
  ).slice(0, 5)
  return { input, status: "unmatched", suggestions }
}

function disambiguate(cands: PeakRow[], ctx: MatchContext): PeakRow | null {
  const pick = (f: (p: PeakRow) => boolean) => {
    const c = cands.filter(f)
    return c.length === 1 ? c[0] : null
  }
  if (ctx.listSlug) {
    const ids = listPeakIds(ctx.listSlug)
    const p = pick((c) => ids.has(c.id))
    if (p) return p
  }
  if (ctx.state) {
    const p = pick((c) => c.state?.toUpperCase() === ctx.state!.toUpperCase())
    if (p) return p
  }
  if (ctx.siblingStates?.length) {
    const s = new Set(ctx.siblingStates.map((x) => x.toUpperCase()))
    const p = pick((c) => !!c.state && s.has(c.state.toUpperCase()))
    if (p) return p
  }
  // Last resort: the state this instance hikes in most (e.g. "Adams" -> NH, not WA,
  // for a New Hampshire household). Only when exactly one candidate is in that state.
  for (const st of hikedStates()) {
    const p = pick((c) => c.state?.toUpperCase() === st)
    if (p) return p
    if (cands.some((c) => c.state?.toUpperCase() === st)) break
  }
  return null
}

let statesCache: { at: number; states: string[] } | null = null
function hikedStates(): string[] {
  if (statesCache && Date.now() - statesCache.at < 60_000) return statesCache.states
  const states = all<{ state: string }>(
    `SELECT UPPER(p.state) state, COUNT(*) n FROM hike_peaks hp JOIN peaks p ON p.id = hp.peak_id
     WHERE p.state IS NOT NULL GROUP BY UPPER(p.state) ORDER BY n DESC LIMIT 3`
  ).map((r) => r.state)
  statesCache = { at: Date.now(), states }
  return states
}

/**
 * Match a list of names (or one comma-separated string). Two passes so that
 * unambiguous siblings ("Lafayette, Lincoln") inform ambiguous ones.
 */
export function matchPeaks(inputs: string | string[], ctx: MatchContext = {}): MatchResult[] {
  const names = Array.isArray(inputs) ? inputs.flatMap((s) => splitPeakNames(s)) : splitPeakNames(inputs)
  const first = names.map((n) => matchPeak(n, ctx))
  const siblingStates = first
    .filter((r): r is Extract<MatchResult, { status: "matched" }> => r.status === "matched")
    .map((r) => r.peak.state)
    .filter((s): s is string => !!s)
  return first.map((r, i) => (r.status === "ambiguous" ? matchPeak(names[i], { ...ctx, siblingStates }) : r))
}

export function searchPeaks(q: string, limit = 20): PeakRow[] {
  const n = normalizePeakName(q)
  if (!n) return []
  const rows = aliasRows().filter((r) => r.alias.includes(n))
  rows.sort((a, b) => (a.alias.startsWith(n) ? 0 : 1) - (b.alias.startsWith(n) ? 0 : 1) || (b.elevation_ft ?? 0) - (a.elevation_ft ?? 0))
  return uniq(rows).slice(0, limit)
}
