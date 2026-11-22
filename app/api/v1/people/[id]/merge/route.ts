import { z } from "zod"
import { intParam, json, readJson, requirePerson, withAuth } from "@/lib/api"
import { mergePeople } from "@/lib/people"

const schema = z.object({ into: z.union([z.number().int(), z.string().min(1)]) })

export const POST = withAuth<{ id: string }>(async (req, { params }) => {
  const { into } = schema.parse(await readJson(req))
  const target = requirePerson(String(into))
  return json({ person: mergePeople(intParam(params.id), target.id) })
})
