import { ApiError, intParam, json, readJson, withAuth } from "@/lib/api"
import { deletePerson, getPerson, updatePerson } from "@/lib/people"

type P = { id: string }

export const GET = withAuth<P>(async (_req, { params }) => {
  const person = getPerson(intParam(params.id))
  if (!person) throw new ApiError("Person not found", 404)
  return json({ person })
})
export const PATCH = withAuth<P>(async (req, { params }) => json({ person: updatePerson(intParam(params.id), await readJson(req)) }))
export const DELETE = withAuth<P>(async (req, { params }) => {
  const force = ["1", "true"].includes(new URL(req.url).searchParams.get("force") ?? "")
  deletePerson(intParam(params.id), force)
  return json({ ok: true })
})
