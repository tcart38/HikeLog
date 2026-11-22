import { ApiError, json, withAuth } from "@/lib/api"
import { listGarminActivities } from "@/lib/garmin/sync"

export const GET = withAuth(async (req, { user }) => {
  const status = new URL(req.url).searchParams.get("status")
  if (status && !["pending", "imported", "ignored"].includes(status)) throw new ApiError("status must be pending, imported or ignored")
  return json({ activities: listGarminActivities(user.id, status ?? undefined) })
})
