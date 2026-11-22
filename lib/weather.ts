import "server-only"
import { all, get, run } from "./db"
import { HikeError } from "./hikes"
import { appTimeZone } from "./seasons"

/**
 * Historical / recent weather for a hike from Open-Meteo (https://open-meteo.com, CC BY 4.0, free for non-commercial use, no key).
 * Mountain Forecast has no public API and its terms don't allow automated pulls, so it is not used.
 * Open-Meteo's grid is ~10 km (ERA5) and we ask it to correct temperature to the summit's elevation; winds are modelled
 * at 10 m over a smoothed grid, so ridge and summit gusts are usually much stronger than shown.
 */
export type DayWeather = {
  date: string
  code: number | null
  summary: string
  tMaxF: number | null
  tMinF: number | null
  windMaxMph: number | null
  gustMaxMph: number | null
  precipIn: number | null
  snowIn: number | null
}
export type HikeWeather = {
  source: "open-meteo"
  fetchedAt: string
  location: { lat: number; lon: number; elevationFt: number | null; label: string }
  days: DayWeather[]
}

const WMO: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Rain showers", 82: "Heavy showers", 85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorms", 96: "Thunderstorms, hail", 99: "Thunderstorms, hail",
}
export const wmoText = (c: number | null) => (c == null ? "" : (WMO[c] ?? ""))

const DAILY = "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,snowfall_sum"

const pad = (n: number) => String(n).padStart(2, "0")
const daysAgo = (date: string) => (Date.now() - Date.parse(`${date}T12:00:00Z`)) / 86_400_000

export async function fetchDaily(lat: number, lon: number, elevationFt: number | null, start: string, end: string): Promise<DayWeather[]> {
  // The archive lags real time by several days; recent dates come from the forecast service, which keeps ~3 months of past days.
  const recent = daysAgo(end) < 8
  const base = recent ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive"
  const u = new URL(base)
  u.searchParams.set("latitude", lat.toFixed(4))
  u.searchParams.set("longitude", lon.toFixed(4))
  if (elevationFt) u.searchParams.set("elevation", String(Math.round(elevationFt * 0.3048)))
  u.searchParams.set("start_date", start)
  u.searchParams.set("end_date", end)
  u.searchParams.set("daily", DAILY)
  u.searchParams.set("temperature_unit", "fahrenheit")
  u.searchParams.set("wind_speed_unit", "mph")
  u.searchParams.set("precipitation_unit", "inch")
  u.searchParams.set("timezone", appTimeZone())
  let res: Response
  try {
    res = await fetch(u, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "HikeLog (self-hosted)" } })
  } catch {
    throw new HikeError("Couldn't reach the weather service. Check the server's internet access and try again.", undefined, 502)
  }
  const body = (await res.json().catch(() => null)) as { reason?: string; daily?: Record<string, (number | null)[] & string[]> } | null
  if (!res.ok || !body?.daily) throw new HikeError(`Weather service: ${body?.reason ?? res.statusText}`, undefined, 502)
  const d = body.daily
  const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10)
  return (d.time as string[]).map((date, i) => {
    const code = (d.weather_code?.[i] as number | null) ?? null
    return {
      date,
      code,
      summary: wmoText(code),
      tMaxF: r1(d.temperature_2m_max?.[i] as number | null),
      tMinF: r1(d.temperature_2m_min?.[i] as number | null),
      windMaxMph: r1(d.wind_speed_10m_max?.[i] as number | null),
      gustMaxMph: r1(d.wind_gusts_10m_max?.[i] as number | null),
      precipIn: r1(d.precipitation_sum?.[i] as number | null),
      snowIn: r1(d.snowfall_sum?.[i] as number | null),
    }
  })
}

type Spot = { lat: number; lon: number; elevationFt: number | null; label: string }

/** Where to ask for weather: the highest peak with coordinates, otherwise the start of the GPS track. */
export function hikeSpot(hikeId: number): Spot | null {
  const p = get<{ name: string; lat: number; lon: number; elevation_ft: number | null }>(
    `SELECT p.name, p.lat, p.lon, p.elevation_ft FROM hike_peaks hp JOIN peaks p ON p.id = hp.peak_id
     WHERE hp.hike_id = ? AND p.lat IS NOT NULL AND p.lon IS NOT NULL ORDER BY p.elevation_ft DESC LIMIT 1`,
    hikeId
  )
  if (p) return { lat: p.lat, lon: p.lon, elevationFt: p.elevation_ft, label: p.name }
  const t = get<{ min_lat: number; max_lat: number; min_lon: number; max_lon: number }>("SELECT min_lat, max_lat, min_lon, max_lon FROM hike_tracks WHERE hike_id = ?", hikeId)
  if (t) return { lat: (t.min_lat + t.max_lat) / 2, lon: (t.min_lon + t.max_lon) / 2, elevationFt: null, label: "GPS track" }
  return null
}

export function getWeather(hikeId: number): HikeWeather | null {
  const r = get<{ weather_json: string | null }>("SELECT weather_json FROM hikes WHERE id = ?", hikeId)
  if (!r?.weather_json) return null
  try {
    return JSON.parse(r.weather_json) as HikeWeather
  } catch {
    return null
  }
}

export async function importWeather(hikeId: number): Promise<HikeWeather> {
  const h = get<{ date: string; end_date: string | null }>("SELECT date, end_date FROM hikes WHERE id = ?", hikeId)
  if (!h) throw new HikeError("Hike not found", undefined, 404)
  const spot = hikeSpot(hikeId)
  if (!spot) throw new HikeError("This hike has no peak with known coordinates or GPS track to look up weather for", undefined, 422)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: appTimeZone() }).format(new Date())
  if (h.date > today) throw new HikeError("That hike is in the future; weather can be imported once it starts", undefined, 422)
  // Multi-day trips: cap at a week so one call stays small.
  let end = h.end_date && h.end_date > h.date ? h.end_date : h.date
  const cap = new Date(Date.parse(`${h.date}T00:00:00Z`) + 6 * 86_400_000)
  const capStr = `${cap.getUTCFullYear()}-${pad(cap.getUTCMonth() + 1)}-${pad(cap.getUTCDate())}`
  if (end > capStr) end = capStr
  if (end > today) end = today
  const days = await fetchDaily(spot.lat, spot.lon, spot.elevationFt, h.date, end)
  const w: HikeWeather = { source: "open-meteo", fetchedAt: new Date().toISOString(), location: spot, days }
  run("UPDATE hikes SET weather_json = ? WHERE id = ?", JSON.stringify(w), hikeId)
  return w
}

export function clearWeather(hikeId: number) {
  run("UPDATE hikes SET weather_json = NULL WHERE id = ?", hikeId)
}

/** Hikes that could have weather but don't yet. */
export function hikesMissingWeather(limit: number): { ids: number[]; remaining: number } {
  const rows = all<{ id: number }>(
    `SELECT h.id FROM hikes h WHERE h.weather_json IS NULL AND h.date <= date('now')
     AND (EXISTS (SELECT 1 FROM hike_peaks hp JOIN peaks p ON p.id = hp.peak_id WHERE hp.hike_id = h.id AND p.lat IS NOT NULL)
          OR EXISTS (SELECT 1 FROM hike_tracks t WHERE t.hike_id = h.id))
     ORDER BY h.date DESC`
  )
  return { ids: rows.slice(0, limit).map((r) => r.id), remaining: Math.max(0, rows.length - limit) }
}
