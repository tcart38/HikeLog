import { ApiError, intQuery, json, requirePerson, withAuth } from "@/lib/api"
import { getStats } from "@/lib/stats"

export const GET = withAuth(async (req, { user }) => {
  const q = new URL(req.url).searchParams
  const personId = q.get("person") ? requirePerson(q.get("person")!).id : user.person_id
  if (!personId) throw new ApiError("No person specified and caller has no linked person", 400)
  const withId = q.get("with") ? requirePerson(q.get("with")!).id : null
  const stats = getStats({ personId, withId, year: intQuery(q.get("year")) ?? null })
  if (!stats) throw new ApiError("Person not found", 404)
  return json(stats)
})
