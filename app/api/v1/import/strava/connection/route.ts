import { z } from "zod"
import { baseUrl, json, readJson, withAuth } from "@/lib/api"
import { STRAVA_SETTINGS_URL, stravaAuthorizeUrl, stravaDisconnect, stravaSaveApp, stravaStatus } from "@/lib/import/strava"

const schema = z.object({ clientId: z.string().trim().regex(/^\d{3,12}$/, "Client ID is the number shown on strava.com/settings/api"), clientSecret: z.string().trim().min(16).max(200) })

function status(req: Request, userId: number) {
  const s = stravaStatus(userId)
  const callback = `${baseUrl(req)}/api/v1/import/strava/callback`
  return {
    ...s,
    settingsUrl: STRAVA_SETTINGS_URL,
    callbackUrl: callback,
    callbackDomain: new URL(callback).hostname,
    // Authorise link. Needs the Authorization Callback Domain in your Strava app to match callbackDomain.
    authorizeUrl: s.state === "none" ? null : stravaAuthorizeUrl(userId, callback),
    // Fallback for hosts Strava won't accept as a callback domain: set the domain to "localhost", authorise, then paste the address Strava sends you to.
    authorizeUrlLocalhost: s.state === "none" ? null : stravaAuthorizeUrl(userId, "http://localhost/hikelog"),
  }
}

export const GET = withAuth(async (req, { user }) => json(status(req, user.id)))

/** Save your own Strava API app credentials (Client ID and Client Secret). Stored encrypted. */
export const PUT = withAuth(async (req, { user }) => {
  const { clientId, clientSecret } = schema.parse(await readJson(req))
  stravaSaveApp(user.id, clientId, clientSecret)
  return json(status(req, user.id))
})

export const DELETE = withAuth(async (_req, { user }) => {
  stravaDisconnect(user.id)
  return json({ ok: true })
})
