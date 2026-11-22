import { ApiError, json, withAuth } from "@/lib/api"
import { all, get } from "@/lib/db"
import { matchPeak } from "@/lib/peaks/match"
import { appTimeZone, isWinterHike, seasonOf } from "@/lib/seasons"

export const GET = withAuth<{ idOrSlug: string }>(async (_req, { params }) => {
  const k = decodeURIComponent(params.idOrSlug)
  let peak = /^\d+$/.test(k)
    ? get<{ id: number }>("SELECT * FROM peaks WHERE id = ?", Number(k))
    : get<{ id: number }>("SELECT * FROM peaks WHERE slug = ?", k.toLowerCase())
  if (!peak) {
    // convenience: accept an unambiguous name too ("lafayette")
    const m = matchPeak(k)
    if (m.status === "matched") peak = get<{ id: number }>("SELECT * FROM peaks WHERE id = ?", m.peak.id)
  }
  if (!peak) throw new ApiError("Peak not found", 404)
  const lists = all(
    `SELECT l.slug, l.name, l.short_name, l.region, lp.rank FROM list_peaks lp JOIN lists l ON l.id = lp.list_id
     WHERE lp.peak_id = ? ORDER BY l.region, l.name`,
    peak.id
  )
  const tz = appTimeZone()
  const ascents = all<{
    hike_id: number
    date: string
    end_date: string | null
    conditions: string | null
    person_id: number
    person_name: string
    counts: number
  }>(
    `SELECT h.id hike_id, h.date, h.end_date, h.conditions, pe.id person_id, pe.name person_name, hp.counts
     FROM hike_peaks k JOIN hikes h ON h.id = k.hike_id
     JOIN hike_participants hp ON hp.hike_id = h.id JOIN people pe ON pe.id = hp.person_id
     WHERE k.peak_id = ? ORDER BY h.date DESC, pe.name`,
    peak.id
  ).map((a) => ({ ...a, season: seasonOf(a.date, tz), is_winter: isWinterHike(a.date, a.end_date, tz) }))
  return json({ peak, lists, ascents })
})
