import { ApiError, json, readJson, requirePerson, withAuth } from "@/lib/api"
import { listPlans, savePlan } from "@/lib/planned"

export const GET = withAuth(async (req, { user }) => {
  const q = new URL(req.url).searchParams
  const personId = q.get("person") ? requirePerson(q.get("person")!).id : user.person_id
  if (!personId) throw new ApiError("Pass ?person= (this account is not linked to a person)", 400)
  const done = q.get("status") === "done"
  return json({ plannedHikes: listPlans(personId, { done }) })
})

export const POST = withAuth(async (req, { user }) => {
  const body = await readJson(req)
  if (body.personId == null && user.person_id) body.personId = user.person_id
  return json({ plannedHike: savePlan(body, { userId: user.id }) }, 201)
})
