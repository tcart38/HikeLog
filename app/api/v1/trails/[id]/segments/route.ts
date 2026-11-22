import { intParam, json, withAuth } from "@/lib/api"
import { trailSegments } from "@/lib/coverage"
import { peopleParam } from "@/lib/map-params"

/** Segments of one trail with who has covered each (used by the map's "mark a section" mode). */
export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  const ids = peopleParam(new URL(req.url).searchParams.get("person"), user)
  return json(trailSegments(intParam(params.id), ids))
})
