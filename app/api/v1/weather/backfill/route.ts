import { json, withAuth } from "@/lib/api"
import { hikesMissingWeather, importWeather } from "@/lib/weather"

/** Import weather for hikes that don't have any yet, up to `limit` (default 20, max 50) per call. Call again while `remaining` > 0. */
export const POST = withAuth(async (req) => {
  const n = Number(new URL(req.url).searchParams.get("limit"))
  const limit = Math.min(Math.max(Number.isInteger(n) && n > 0 ? n : 20, 1), 50)
  const { ids, remaining } = hikesMissingWeather(limit)
  let imported = 0
  const failed: { id: number; error: string }[] = []
  for (const id of ids) {
    try {
      await importWeather(id)
      imported++
    } catch (e) {
      failed.push({ id, error: e instanceof Error ? e.message : "failed" })
      // The service being unreachable or rate-limiting won't fix itself within this call.
      if (failed.length >= 3 && imported === 0) break
    }
  }
  return json({ imported, failed, remaining: remaining + failed.length })
})
