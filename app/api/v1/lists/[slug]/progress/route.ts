import { publicList, ApiError, json, parseMode, requirePerson, withAuth } from "@/lib/api"
import { getPerson } from "@/lib/people"
import { listProgress } from "@/lib/progress"

export const GET = withAuth<{ slug: string }>(async (req, { user, params }) => {
  const q = new URL(req.url).searchParams
  const personId = q.get("person") ? requirePerson(q.get("person")!).id : user.person_id
  if (!personId) throw new ApiError("No person specified and caller has no linked person", 400)
  const p = listProgress(params.slug, personId, parseMode(q.get("mode")))
  if (!p) throw new ApiError("List not found", 404)
  const person = getPerson(personId)
  return json({ ...p, list: publicList(p.list), person: person && { id: person.id, name: person.name, color: person.color } })
})
