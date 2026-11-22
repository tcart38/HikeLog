import { z } from "zod"
import { json, readJson, requirePerson, withAuth } from "@/lib/api"
import { setManualCoverage } from "@/lib/coverage"

const schema = z.object({
  trailId: z.number().int(),
  person: z.union([z.number().int(), z.string().min(1)]).optional(),
  fromIdx: z.number().int().min(0).nullish(),
  toIdx: z.number().int().min(0).nullish(),
  covered: z.boolean().default(true),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").nullish(),
  hikeId: z.number().int().nullish(),
})

export const POST = withAuth(async (req, { user }) => {
  const b = schema.parse(await readJson(req))
  const personId = b.person != null ? requirePerson(String(b.person)).id : user.person_id
  if (!personId) return json({ error: "person is required" }, 400)
  const r = setManualCoverage({ trailId: b.trailId, personId, fromIdx: b.fromIdx, toIdx: b.toIdx, covered: b.covered, date: b.date, hikeId: b.hikeId })
  return json({ ok: true, ...r })
})
