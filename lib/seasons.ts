/**
 * Astronomical seasons, as used by peakbagging clubs (AMC 4000 Footer Club,
 * ADK 46ers, Catskill 3500 Club): winter runs from the December solstice to
 * the March equinox. Pure functions, safe on client and server.
 *
 * Equinox/solstice instants use Meeus, "Astronomical Algorithms" ch. 27
 * (accurate to about a minute for 1000-3000 AD). We compare at the date level
 * in the configured time zone: the solstice date counts as winter, the
 * equinox date counts as spring (conservative, since most hikes start in the morning
 * and we usually lack times).
 */

export type Season = "winter" | "spring" | "summer" | "fall"
export const SEASONS: Season[] = ["winter", "spring", "summer", "fall"]
export const SEASON_LABEL: Record<Season, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
}
export const MONTH_LABEL = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export const DEFAULT_TZ = "America/New_York"

/** Julian Ephemeris Day of an equinox/solstice. k: 0=Mar equinox, 1=Jun solstice, 2=Sep equinox, 3=Dec solstice */
function seasonJDE(year: number, k: 0 | 1 | 2 | 3): number {
  const Y = (year - 2000) / 1000
  const base = [
    2451623.80984 + 365242.37404 * Y + 0.05169 * Y ** 2 - 0.00411 * Y ** 3 - 0.00057 * Y ** 4,
    2451716.56767 + 365241.62603 * Y + 0.00325 * Y ** 2 + 0.00888 * Y ** 3 - 0.0003 * Y ** 4,
    2451810.21715 + 365242.01767 * Y - 0.11575 * Y ** 2 + 0.00337 * Y ** 3 + 0.00078 * Y ** 4,
    2451900.05952 + 365242.74049 * Y - 0.06223 * Y ** 2 - 0.00823 * Y ** 3 + 0.00032 * Y ** 4,
  ][k]
  const T = (base - 2451545.0) / 36525
  const W = (35999.373 * T - 2.47) * (Math.PI / 180)
  const dL = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W)
  const A = [485, 203, 199, 182, 156, 136, 77, 74, 70, 58, 52, 50, 45, 44, 29, 18, 17, 16, 14, 12, 12, 12, 9, 8]
  const B = [324.96, 337.23, 342.08, 27.85, 73.14, 171.52, 222.54, 296.72, 243.58, 119.81, 297.17, 21.02, 247.54, 325.15, 60.93, 155.12, 288.79, 198.04, 199.76, 95.39, 287.11, 320.81, 227.73, 15.45]
  const C = [1934.136, 32964.467, 20.186, 445267.112, 45036.886, 22518.443, 65928.934, 3034.906, 9037.513, 33718.147, 150.678, 2281.226, 29929.562, 31555.956, 4443.417, 67555.328, 4562.452, 62894.029, 31436.921, 14577.848, 31931.756, 34777.259, 1222.114, 16859.074]
  let S = 0
  for (let i = 0; i < 24; i++) S += A[i] * Math.cos(((B[i] + C[i] * T) * Math.PI) / 180)
  return base + (0.00001 * S) / dL
}

function jdeToDate(jde: number): Date {
  // Ignore the ~70s TT-UT difference; irrelevant at date resolution except within a minute of midnight.
  return new Date((jde - 2440587.5) * 86400000)
}

function localDate(d: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
}

const cache = new Map<string, { mar: string; jun: string; sep: string; dec: string }>()

/** Local dates (YYYY-MM-DD) of the four season starts for a year. */
export function seasonStarts(year: number, tz = DEFAULT_TZ) {
  const key = `${year}|${tz}`
  let v = cache.get(key)
  if (!v) {
    v = {
      mar: localDate(jdeToDate(seasonJDE(year, 0)), tz),
      jun: localDate(jdeToDate(seasonJDE(year, 1)), tz),
      sep: localDate(jdeToDate(seasonJDE(year, 2)), tz),
      dec: localDate(jdeToDate(seasonJDE(year, 3)), tz),
    }
    cache.set(key, v)
  }
  return v
}

/** Season of a YYYY-MM-DD date. */
export function seasonOf(date: string, tz = DEFAULT_TZ): Season {
  const year = Number(date.slice(0, 4))
  const s = seasonStarts(year, tz)
  if (date < s.mar) return "winter"
  if (date < s.jun) return "spring"
  if (date < s.sep) return "summer"
  if (date < s.dec) return "fall"
  return "winter"
}

/**
 * Winter "season year" label, e.g. a hike on 2026-01-10 belongs to winter 2025–26.
 * Returns the year the winter started in (2025), or null if not winter.
 */
export function winterSeasonYear(date: string, tz = DEFAULT_TZ): number | null {
  if (seasonOf(date, tz) !== "winter") return null
  const year = Number(date.slice(0, 4))
  return Number(date.slice(5, 7)) >= 12 ? year : year - 1
}

/**
 * True when a hike counts as a winter ascent: start AND end inside the same
 * astronomical winter.
 */
export function isWinterHike(start: string, end?: string | null, tz = DEFAULT_TZ): boolean {
  const a = winterSeasonYear(start, tz)
  if (a === null) return false
  if (!end || end === start) return true
  return winterSeasonYear(end, tz) === a
}

/** 1-12 month of a YYYY-MM-DD date (grid credit uses the start date). */
export function monthOf(date: string): number {
  return Number(date.slice(5, 7))
}

export function appTimeZone(): string {
  return (typeof process !== "undefined" && process.env?.APP_TIMEZONE) || DEFAULT_TZ
}
