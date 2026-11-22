import { z } from "zod"
import { ApiError, json, readJson, withAuth } from "@/lib/api"
import { stravaExchange, stravaStatus } from "@/lib/import/strava"
import { ImportError } from "@/lib/import/store"

const schema = z.object({ code: z.string().trim().min(3).max(2000) })

/** Finish authorisation from a pasted code or the full redirect address Strava sent you to. */
export const POST = withAuth(async (req, { user }) => {
  const { code } = schema.parse(await readJson(req))
  try {
    await stravaExchange(user.id, code)
  } catch (e) {
    if (e instanceof ImportError) throw new ApiError(e.message, e.status)
    throw e
  }
  return json(stravaStatus(user.id))
})
