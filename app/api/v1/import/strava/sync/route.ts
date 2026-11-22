import { ApiError, json, withAuth } from "@/lib/api"
import { ImportError } from "@/lib/import/store"
import { stravaStatus, stravaSync } from "@/lib/import/strava"

export const POST = withAuth(async (_req, { user }) => {
  try {
    return json({ ...(await stravaSync(user.id)), connection: stravaStatus(user.id) })
  } catch (e) {
    if (e instanceof ImportError) throw new ApiError(e.message, e.status)
    throw e
  }
})
