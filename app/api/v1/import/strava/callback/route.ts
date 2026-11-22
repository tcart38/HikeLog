import { baseUrl, withAuth } from "@/lib/api"
import { stravaExchange } from "@/lib/import/strava"

/** Browser redirect target for Strava's OAuth (needs your session cookie). Sends you back to Settings. */
export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url)
  const back = new URL("/settings/import", baseUrl(req))
  back.searchParams.set("source", "strava")
  try {
    if (url.searchParams.get("error")) throw new Error("Access was declined on Strava.")
    await stravaExchange(user.id, url.searchParams.get("code") ?? "", url.searchParams.get("state"))
    back.searchParams.set("strava", "ok")
  } catch (e) {
    back.searchParams.set("strava", e instanceof Error ? e.message : "failed")
  }
  return Response.redirect(back, 303)
})
