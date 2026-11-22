import { ApiError, withAuth } from "@/lib/api"
import { networkGeoJson } from "@/lib/coverage"
import { getNetwork } from "@/lib/networks"
import { peopleParam } from "@/lib/map-params"

/** FeatureCollection of trail runs; properties.covered = 1 when the first listed person has hiked that stretch. */
export const GET = withAuth<{ slug: string }>(async (req, { user, params }) => {
  const net = getNetwork(params.slug)
  if (!net) throw new ApiError("Network not found", 404)
  if (!net.fetched_at) throw new ApiError("Network has not been downloaded yet", 404)
  const ids = peopleParam(new URL(req.url).searchParams.get("person"), user)
  return Response.json(networkGeoJson(net.id, ids), { headers: { "Cache-Control": "private, no-store" } })
})
