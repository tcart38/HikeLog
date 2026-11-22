import { ApiError, json, withAuth } from "@/lib/api"
import { GarminError } from "@/lib/garmin/client"
import { connectionStatus, syncUser } from "@/lib/garmin/sync"

export const POST = withAuth(async (_req, { user }) => {
  try {
    const result = await syncUser(user.id)
    return json({ ...result, connection: connectionStatus(user.id) })
  } catch (e) {
    if (e instanceof GarminError) throw new ApiError(e.message, 502)
    throw e
  }
})
