import { intParam, json, withAuth } from "@/lib/api"
import { ignoreActivity } from "@/lib/garmin/sync"

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => json({ activity: ignoreActivity(user.id, intParam(params.id)) }))
