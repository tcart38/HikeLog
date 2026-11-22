import { z } from "zod"
import { intParam, json, readJson, withAuth } from "@/lib/api"
import { mergeActivity } from "@/lib/garmin/sync"

const schema = z.object({ hikeId: z.number().int(), addPeaks: z.array(z.number().int()).optional() })

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const body = schema.parse(await readJson(req))
  return json(mergeActivity(user, intParam(params.id), body.hikeId, body.addPeaks), 200)
})
