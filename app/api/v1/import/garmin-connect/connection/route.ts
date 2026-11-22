import { z } from "zod"
import { json, readJson, withAuth } from "@/lib/api"
import { garminConnectDisconnect, garminConnectLogin, garminConnectMfa, garminConnectStatus } from "@/lib/import/garmin-connect"
import { ImportError } from "@/lib/import/store"
import { ApiError } from "@/lib/api"

const schema = z.union([
  z.object({ email: z.string().trim().min(3).max(320), password: z.string().min(1).max(500) }),
  z.object({ mfaCode: z.string().trim().min(4).max(12) }),
])

export const GET = withAuth(async (_req, { user }) => json(garminConnectStatus(user.id)))

/** Sign in with email + password, or finish an MFA challenge with { mfaCode }. The password is never stored. */
export const PUT = withAuth(async (req, { user }) => {
  const body = schema.parse(await readJson(req))
  try {
    const r = "mfaCode" in body ? await garminConnectMfa(user.id, body.mfaCode) : await garminConnectLogin(user.id, body.email, body.password)
    return json({ result: r.status, connection: garminConnectStatus(user.id) })
  } catch (e) {
    if (e instanceof ImportError) throw new ApiError(e.message, e.status)
    throw e
  }
})

export const DELETE = withAuth(async (_req, { user }) => {
  garminConnectDisconnect(user.id)
  return json({ ok: true })
})
