import { ApiError, intParam, json, readJson, withAuth } from "@/lib/api"
import { deleteHike, getHike, saveHike, type Hike, type HikeInput } from "@/lib/hikes"

type P = { id: string }

function toInput(h: Hike): HikeInput {
  return {
    date: h.date,
    endDate: h.endDate,
    title: h.title,
    // unmatched names are kept so a partial update doesn't silently drop them
    peaks: [...h.peaks.map((p) => p.id), ...h.unmatchedPeaks],
    participants: h.participants.map((p) => ({ person: p.id, counts: p.counts, note: p.note ?? undefined })),
    conditions: h.conditions,
    weather: h.weather,
    trailConditions: h.trailConditions,
    notes: h.notes,
    distanceMi: h.distanceMi,
    elevationGainFt: h.elevationGainFt,
    durationMin: h.durationMin,
    routeType: h.routeType,
    otherLists: h.otherLists,
    externalId: h.externalId,
  }
}

export const GET = withAuth<P>(async (_req, { params }) => {
  const hike = getHike(intParam(params.id))
  if (!hike) throw new ApiError("Hike not found", 404)
  return json({ hike })
})

export const PATCH = withAuth<P>(async (req, { user, via, params }) => {
  const id = intParam(params.id)
  const existing = getHike(id)
  if (!existing) throw new ApiError("Hike not found", 404)
  const body = await readJson<Partial<HikeInput>>(req)
  const merged = { ...toInput(existing), ...body } as HikeInput
  const r = saveHike(merged, { id, userId: user.id, userPersonId: user.person_id, source: via === "token" ? "api" : "web" })
  return json({ hike: r.hike, peakMatches: r.peakMatches })
})

export const DELETE = withAuth<P>(async (_req, { params }) => {
  if (!deleteHike(intParam(params.id))) throw new ApiError("Hike not found", 404)
  return json({ ok: true })
})
