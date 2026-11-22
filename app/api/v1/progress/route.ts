import { publicList, ApiError, json, parseMode, requirePerson, withAuth } from "@/lib/api"
import { getPerson } from "@/lib/people"
import { allListsProgress } from "@/lib/progress"

export const GET = withAuth(async (req, { user }) => {
  const q = new URL(req.url).searchParams
  const personId = q.get("person") ? requirePerson(q.get("person")!).id : user.person_id
  if (!personId) throw new ApiError("No person specified and caller has no linked person", 400)
  const mode = parseMode(q.get("mode"))
  const person = getPerson(personId)!
  return json({
    person: { id: person.id, name: person.name, color: person.color },
    mode,
    lists: allListsProgress(personId, mode).map((r) => ({ ...r, list: publicList(r.list) })),
  })
})
