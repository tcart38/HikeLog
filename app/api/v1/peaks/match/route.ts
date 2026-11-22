import { z } from "zod"
import { json, readJson, withAuth } from "@/lib/api"
import { matchPeaks } from "@/lib/peaks/match"

const schema = z.object({
  names: z.union([z.string(), z.array(z.string())]),
  stateHint: z.string().length(2).nullish(),
  listHint: z.string().nullish(),
})

export const POST = withAuth(async (req) => {
  const b = schema.parse(await readJson(req))
  return json({ results: matchPeaks(b.names, { state: b.stateHint, listSlug: b.listHint }) })
})
