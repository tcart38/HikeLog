import { ApiError, json, withAuth } from "@/lib/api"
import { garminConnectStatus, garminConnectSync } from "@/lib/import/garmin-connect"
import { ImportError } from "@/lib/import/store"

export const POST = withAuth(async (_req, { user }) => {
  try {
    return json({ ...(await garminConnectSync(user.id)), connection: garminConnectStatus(user.id) })
  } catch (e) {
    if (e instanceof ImportError) throw new ApiError(e.message, e.status)
    throw e
  }
})
