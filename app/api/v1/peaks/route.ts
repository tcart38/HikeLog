import { ApiError, intQuery, json, withAuth } from "@/lib/api"
import { all } from "@/lib/db"
import { searchPeaks } from "@/lib/peaks/match"
import { getList, listPeaks } from "@/lib/progress"

export const GET = withAuth(async (req) => {
  const q = new URL(req.url).searchParams
  const text = q.get("q")?.trim()
  const slug = q.get("list")
  const limit = Math.min(intQuery(q.get("limit"), 100) ?? 100, 2000)
  const offset = intQuery(q.get("offset"), 0) ?? 0
  let listIds: Set<number> | null = null
  let ranked: ReturnType<typeof listPeaks> | null = null
  if (slug) {
    const list = getList(slug)
    if (!list) throw new ApiError(`List not found: ${slug}`, 404)
    ranked = listPeaks(list.id)
    listIds = new Set(ranked.map((p) => p.id))
  }
  if (text) {
    let found = searchPeaks(text, 500)
    if (listIds) found = found.filter((p) => listIds!.has(p.id))
    return json({ peaks: found.slice(offset, offset + limit), total: found.length })
  }
  if (ranked) return json({ peaks: ranked.slice(offset, offset + limit), total: ranked.length })
  const rows = all("SELECT id, slug, name, elevation_ft, state, range, lat, lon FROM peaks ORDER BY elevation_ft DESC, name LIMIT ? OFFSET ?", limit, offset)
  const total = (all<{ n: number }>("SELECT COUNT(*) n FROM peaks")[0]).n
  return json({ peaks: rows, total })
})
