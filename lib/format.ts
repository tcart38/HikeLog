import type { Season } from "./seasons"

/** YYYY-MM-DD -> Date at local noon (avoids timezone drift). */
function d(date: string) {
  return new Date(`${date}T12:00:00`)
}

export function fmtDate(date: string, opts: { year?: boolean; weekday?: boolean } = {}) {
  return d(date).toLocaleDateString("en-US", {
    weekday: opts.weekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: opts.year === false ? undefined : "numeric",
  })
}

export function fmtRange(date: string, endDate?: string | null) {
  if (!endDate || endDate === date) return fmtDate(date)
  const a = d(date)
  const b = d(endDate)
  if (a.getFullYear() === b.getFullYear())
    return `${fmtDate(date, { year: false })} to ${fmtDate(endDate)}`
  return `${fmtDate(date)} to ${fmtDate(endDate)}`
}

export const fmtFt = (n: number | null | undefined) => (n == null ? "" : `${n.toLocaleString("en-US")} ft`)

export function fmtDuration(min: number | null | undefined) {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`
}

export const SEASON_STYLE: Record<Season, { chip: string; solid: string; dot: string }> = {
  winter: { chip: "bg-season-winter/15 text-season-winter", solid: "bg-season-winter text-background", dot: "bg-season-winter" },
  spring: { chip: "bg-season-spring/15 text-season-spring", solid: "bg-season-spring text-background", dot: "bg-season-spring" },
  summer: { chip: "bg-season-summer/15 text-season-summer", solid: "bg-season-summer text-background", dot: "bg-season-summer" },
  fall: { chip: "bg-season-fall/15 text-season-fall", solid: "bg-season-fall text-background", dot: "bg-season-fall" },
}

/** Meteorological season for a calendar month (1-12), used only to tint grid columns. */
export function monthSeason(m: number): Season {
  if (m === 12 || m <= 2) return "winter"
  if (m <= 5) return "spring"
  if (m <= 8) return "summer"
  return "fall"
}

export const CONDITION_LABEL = { snow: "Snow", no_snow: "No snow", mix: "Mix" } as const

export type View = "all" | "winter" | "season" | "grid" | "conditions"
export const VIEWS: { value: View; label: string }[] = [
  { value: "all", label: "All" },
  { value: "winter", label: "Winter" },
  { value: "season", label: "Four-season" },
  { value: "grid", label: "Grid" },
  { value: "conditions", label: "Conditions" },
]
export const parseView = (v: unknown): View =>
  (VIEWS.some((x) => x.value === v) ? v : "all") as View

export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)

export function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export const COMPARE_MODES = [
  { value: "all", label: "All" },
  { value: "winter", label: "Winter" },
  { value: "season", label: "Four-season" },
  { value: "grid", label: "Grid" },
]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?"
}
