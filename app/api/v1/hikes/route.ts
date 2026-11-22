import { ApiError, intQuery, json, readJson, requirePerson, withAuth } from "@/lib/api"
import { listHikes, saveHike, type HikeInput } from "@/lib/hikes"
import { matchPeak } from "@/lib/peaks/match"
import { getList } from "@/lib/progress"

export const GET = withAuth(async (req) => {
  const q = new URL(req.url).searchParams
  const f: Parameters<typeof listHikes>[0] = {
    from: q.get("from") || undefined,
    to: q.get("to") || undefined,
    q: q.get("q") || undefined,
    limit: intQuery(q.get("limit"), 50),
    offset: intQuery(q.get("offset"), 0),
  }
  if (q.get("person")) f.personId = requirePerson(q.get("person")!).id
  if (q.get("peak")) {
    const m = matchPeak(q.get("peak")!)
    if (m.status !== "matched") throw new ApiError(`Peak not found or ambiguous: ${q.get("peak")}`, 404)
    f.peakId = m.peak.id
  }
  if (q.get("list")) {
    if (!getList(q.get("list")!)) throw new ApiError(`List not found: ${q.get("list")}`, 404)
    f.listSlug = q.get("list")!
  }
  return json(listHikes(f))
})

export const POST = withAuth(async (req, { user, via }) => {
  const body = (await readJson(req)) as HikeInput
  const r = saveHike(body, { userId: user.id, userPersonId: user.person_id, source: via === "token" ? "api" : "web" })
  return json({ hike: r.hike, peakMatches: r.peakMatches, created: r.created }, r.created ? 201 : 200)
})
