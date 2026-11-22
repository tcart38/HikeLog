import { publicList, ApiError, json, parseMode, requirePerson, withAuth } from "@/lib/api"
import { listPeople } from "@/lib/people"
import { compare } from "@/lib/progress"

export const GET = withAuth(async (req) => {
  const q = new URL(req.url).searchParams
  const slug = q.get("list")
  if (!slug) throw new ApiError("list (slug) is required", 400)
  const ids = q.get("people")
    ? [...new Set(q.get("people")!.split(",").map((s) => s.trim()).filter(Boolean).map((s) => requirePerson(s).id))]
    : listPeople().filter((p) => p.hike_count > 0).map((p) => p.id)
  if (ids.length < 1) throw new ApiError("people must name at least one person", 400)
  const c = compare(slug, ids, parseMode(q.get("mode")))
  if (!c) throw new ApiError("List not found", 404)
  const people = listPeople().filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, name: p.name, color: p.color }))
  return json({ ...c, list: publicList(c.list), people })
})
