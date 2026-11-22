import { json, withAuth } from "@/lib/api"
import { networkCoverage } from "@/lib/coverage"
import { groupNotes, listNetworks } from "@/lib/networks"
import { peopleParam } from "@/lib/map-params"

export const GET = withAuth(async (req, { user }) => {
  const ids = peopleParam(new URL(req.url).searchParams.get("person"), user)
  const networks = listNetworks().map((n) => ({
    ...n,
    downloaded: !!n.fetched_at,
    coverage: n.fetched_at ? networkCoverage(n.id, ids) : [],
  }))
  return json({ networks, groups: groupNotes() })
})
