import { ApiError, json, withAuth } from "@/lib/api"
import { listGarminActivities } from "@/lib/garmin/sync"
import { findMatches } from "@/lib/import/match"

export const GET = withAuth(async (req, { user }) => {
  const status = new URL(req.url).searchParams.get("status")
  if (status && !["pending", "imported", "ignored"].includes(status)) throw new ApiError("status must be pending, imported or ignored")
  const activities = listGarminActivities(user.id, status ?? undefined).map((a) => ({ ...a, possibleMatches: a.status === "pending" ? findMatches(user, a) : [] }))
  return json({ activities })
})
