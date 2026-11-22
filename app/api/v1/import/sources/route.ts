import { json, withAuth } from "@/lib/api"
import { connectionStatus } from "@/lib/garmin/sync"
import { garminConnectStatus } from "@/lib/import/garmin-connect"
import { SOURCES } from "@/lib/import/meta"
import { stravaStatus } from "@/lib/import/strava"

export const GET = withAuth(async (_req, { user }) =>
  json({
    sources: SOURCES.map((s) => ({
      ...s,
      connection: s.id === "garmin" ? connectionStatus(user.id) : s.id === "garmin_connect" ? garminConnectStatus(user.id) : s.id === "strava" ? stravaStatus(user.id) : null,
    })),
  })
)
