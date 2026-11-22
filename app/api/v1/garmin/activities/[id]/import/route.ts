import { z } from "zod"
import { intParam, json, readJson, withAuth } from "@/lib/api"
import { conditionsSchema } from "@/lib/hikes"
import { importActivity } from "@/lib/garmin/sync"

const schema = z.object({
  peaks: z.array(z.union([z.number().int(), z.string().min(1)])).optional(),
  participants: z
    .array(
      z.union([
        z.number().int(),
        z.string().min(1),
        z.object({ person: z.union([z.number().int(), z.string().min(1)]), counts: z.boolean().optional(), note: z.string().optional() }),
      ])
    )
    .optional(),
  conditions: conditionsSchema.nullish(),
  notes: z.string().nullish(),
  weather: z.string().nullish(),
})

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const body = schema.parse(await readJson(req).catch(() => ({})))
  const r = importActivity(user, intParam(params.id), body)
  return json(r, 201)
})
