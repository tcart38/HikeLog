import { z } from "zod"
import { ApiError, intParam, json, readJson, withAuth } from "@/lib/api"
import { deletePlan, getPlan, savePlan, setPlanDone } from "@/lib/planned"

type P = { id: string }

export const GET = withAuth<P>(async (_req, { params }) => {
  const plan = getPlan(intParam(params.id))
  if (!plan) throw new ApiError("Planned hike not found", 404)
  return json({ plannedHike: plan })
})

/** Edit fields, or change status: `{done: true, hikeId?}` marks it done (linking the logged hike), `{done: false}` reopens. */
export const PATCH = withAuth<P>(async (req, { user, params }) => {
  const id = intParam(params.id)
  const cur = getPlan(id)
  if (!cur) throw new ApiError("Planned hike not found", 404)
  const body = await readJson(req)
  if ("done" in body) {
    const { done, hikeId } = z.object({ done: z.boolean(), hikeId: z.number().int().nullish() }).parse(body)
    return json({ plannedHike: setPlanDone(id, done, hikeId) })
  }
  const merged = {
    personId: cur.personId,
    name: cur.name,
    targetDate: cur.targetDate,
    notes: cur.notes,
    peakIds: cur.peaks.map((p) => p.id),
    ...body,
  }
  return json({ plannedHike: savePlan(merged, { id, userId: user.id }) })
})

export const DELETE = withAuth<P>(async (_req, { params }) => {
  if (!deletePlan(intParam(params.id))) throw new ApiError("Planned hike not found", 404)
  return json({ ok: true })
})
