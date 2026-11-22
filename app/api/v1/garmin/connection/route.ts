import { z } from "zod"
import { ApiError, json, readJson, withAuth } from "@/lib/api"
import { GarminError } from "@/lib/garmin/client"
import { connect, connectionStatus, disconnect } from "@/lib/garmin/sync"

const schema = z.object({
  apiKey: z.string().trim().min(8).max(4000),
  /** Optional: the expiry you chose when creating the key (YYYY-MM-DD), shown as a reminder. */
  keyExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
})

export const GET = withAuth(async (_req, { user }) => json(connectionStatus(user.id)))

export const PUT = withAuth(async (req, { user }) => {
  const { apiKey, keyExpiresAt } = schema.parse(await readJson(req))
  try {
    await connect(user.id, apiKey, keyExpiresAt)
  } catch (e) {
    if (e instanceof GarminError) throw new ApiError(e.message, e.status === 400 ? 422 : e.status === 429 ? 429 : 502)
    throw e
  }
  return json(connectionStatus(user.id))
})

export const DELETE = withAuth(async (_req, { user }) => {
  disconnect(user.id)
  return json({ ok: true })
})
