import { ApiError, json, withAuth } from "@/lib/api"
import { networkCoverage, trailProgress } from "@/lib/coverage"
import { getNetwork } from "@/lib/networks"
import { peopleParam } from "@/lib/map-params"

export const GET = withAuth<{ slug: string }>(async (req, { user, params }) => {
  const net = getNetwork(params.slug)
  if (!net) throw new ApiError("Network not found", 404)
  const sp = new URL(req.url).searchParams
  const ids = peopleParam(sp.get("person"), user)
  const trails = sp.get("trails") === "0" ? undefined : trailProgress(net.id, ids)
  return json({ network: { ...net, downloaded: !!net.fetched_at }, coverage: networkCoverage(net.id, ids), trails })
})
