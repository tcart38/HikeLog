import { ApiError, json, withAuth } from "@/lib/api"
import { downloadNetwork, listNetworks, loadDefinitions } from "@/lib/networks"

/** Downloads from the OSM Overpass API. Can take minutes for big networks. A group slug downloads every section. */
export const POST = withAuth<{ slug: string }>(
  async (_req, { params }) => {
    const group = loadDefinitions().find((g) => g.slug === params.slug)
    const slugs = group ? group.sections.map((s) => s.slug) : [params.slug]
    const results = []
    for (const s of slugs) results.push(await downloadNetwork(s))
    if (!results.length) throw new ApiError("Nothing to download", 404)
    return json({ results, networks: listNetworks().filter((n) => slugs.includes(n.slug)) })
  },
  { admin: true }
)
