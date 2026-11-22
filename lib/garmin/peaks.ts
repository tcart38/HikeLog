import "server-only"
import { all } from "../db"
import { matchPeaks } from "../peaks/match"
import type { TrackPoint } from "./client"
import { PEAK_ELEV_TOLERANCE_FT, PEAK_RADIUS_M } from "./config"

export type PeakSuggestion = {
  id: number
  slug: string
  name: string
  elevationFt: number | null
  state: string | null
  reason: "track" | "title"
  detail: string
}

type PeakGeo = { id: number; slug: string; name: string; elevation_ft: number | null; state: string | null; lat: number; lon: number }

const R = 6371000
function distM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function peaksFromTrack(track: TrackPoint[]): PeakSuggestion[] {
  if (!track.length) return []
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
  for (const p of track) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon)
  }
  const pad = 0.01 // ~1 km, cheap bounding-box prefilter
  const cands = all<PeakGeo>(
    "SELECT id, slug, name, elevation_ft, state, lat, lon FROM peaks WHERE lat IS NOT NULL AND lon IS NOT NULL AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?",
    minLat - pad, maxLat + pad, minLon - pad, maxLon + pad
  )
  const out: PeakSuggestion[] = []
  for (const pk of cands) {
    let best: { d: number; p: TrackPoint } | null = null
    for (const p of track) {
      if (Math.abs(p.lat - pk.lat) > 0.003 || Math.abs(p.lon - pk.lon) > 0.005) continue
      const d = distM(p.lat, p.lon, pk.lat, pk.lon)
      if (d > PEAK_RADIUS_M) continue
      // elevation must be near the summit when both are known (filters passing under a peak, e.g. in a valley)
      if (pk.elevation_ft != null && p.eleM != null && Math.abs(p.eleM * 3.28084 - pk.elevation_ft) > PEAK_ELEV_TOLERANCE_FT) continue
      if (!best || d < best.d) best = { d, p }
    }
    if (best) out.push({ id: pk.id, slug: pk.slug, name: pk.name, elevationFt: pk.elevation_ft, state: pk.state, reason: "track", detail: `Track passes ${Math.round(best.d)} m from the summit` })
  }
  return out
}

const SEPARATORS = /\s*(?:,|\/|&|\+|;|\band\b|\bto\b|\bthen\b|\bvia\b|–|—| - )\s*/i

export function peaksFromTitle(title: string | null): PeakSuggestion[] {
  if (!title) return []
  const parts = title.split(SEPARATORS).map((s) => s.trim()).filter((s) => s.length >= 3)
  const out: PeakSuggestion[] = []
  for (const m of matchPeaks(parts)) {
    if (m.status === "matched") {
      const p = m.peak
      out.push({ id: p.id, slug: p.slug, name: p.name, elevationFt: p.elevation_ft, state: p.state, reason: "title", detail: `Matches "${m.input}" in the title` })
    }
  }
  return out
}

/** Track matches first, then title matches not already found. */
export function suggestPeaks(title: string | null, track: TrackPoint[]): PeakSuggestion[] {
  const out = peaksFromTrack(track)
  const seen = new Set(out.map((p) => p.id))
  for (const s of peaksFromTitle(title)) if (!seen.has(s.id)) { seen.add(s.id); out.push(s) }
  return out
}
