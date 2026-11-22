import type { Metadata } from "next"

import { MapLoader } from "@/components/map/map-loader"
import type { MapNetwork, MapPeak } from "@/components/map/types"
import { personColor } from "@/components/map/map-utils"
import { COMPARE_MODES, fmtDate, one } from "@/lib/format"
import { networkCoverage } from "@/lib/coverage"
import { listHikes } from "@/lib/hikes"
import { listNetworks } from "@/lib/networks"
import { listLists, listProgress, MODES, type Mode } from "@/lib/progress"
import { listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Map" }

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const user = await requireUser()
  const sp = await searchParams
  const people = listPeople()
  const colors = people.map((p, i) => ({ id: p.id, name: p.name, color: personColor(p.color, i) }))
  const requested = Number(one(sp.person))
  const personId = people.find((p) => p.id === requested)?.id ?? people.find((p) => p.id === user.person_id)?.id ?? people[0]?.id ?? 0

  // peaks
  const lists = listLists()
  const listParam = one(sp.list)
  const listSlug = listParam === "all" || lists.some((l) => l.slug === listParam) ? (listParam as string) : lists.some((l) => l.slug === "nh-48") ? "nh-48" : "all"
  const modeParam = one(sp.mode) as Mode
  const mode: Mode = MODES.includes(modeParam) && COMPARE_MODES.some((m) => m.value === modeParam) ? modeParam : "all"
  const byId = new Map<number, MapPeak>()
  let peakTotal = 0
  const seen = new Set<number>()
  for (const l of listSlug === "all" ? lists : lists.filter((x) => x.slug === listSlug)) {
    const prog = listProgress(l.slug, personId, mode)
    if (!prog) continue
    for (const p of prog.peaks) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        peakTotal++
      }
      if (p.lat == null || p.lon == null) continue
      const date = mode === "winter" ? p.status.firstWinter : p.status.first
      const prev = byId.get(p.id)
      byId.set(p.id, {
        id: p.id,
        slug: p.slug,
        name: p.name,
        elevationFt: p.elevation_ft,
        state: p.state,
        lat: p.lat,
        lon: p.lon,
        done: p.done || !!prev?.done,
        date: p.done ? date : (prev?.date ?? null),
      })
    }
  }

  // trail networks
  const ids = people.map((p) => p.id)
  const networks: MapNetwork[] = listNetworks().map((n) => ({
    slug: n.slug,
    name: n.name,
    groupSlug: n.group_slug,
    groupName: n.group_name,
    downloaded: !!n.fetched_at,
    fetchedAt: n.fetched_at,
    totalMi: n.total_length_mi,
    trailCount: n.trail_count,
    bbox: n.min_lon == null ? null : [n.min_lon, n.min_lat!, n.max_lon!, n.max_lat!],
    coverage: n.fetched_at ? networkCoverage(n.id, ids) : [],
  }))
  const netParam = one(sp.network)
  const networkSlug = networks.find((n) => n.slug === netParam && n.downloaded)?.slug ?? networks.find((n) => n.downloaded)?.slug ?? null

  const hikes = personId
    ? listHikes({ personId, limit: 80 }).hikes.map((h) => ({
        id: h.id,
        date: h.date,
        label: `${fmtDate(h.date)} · ${h.title || h.peaks.slice(0, 2).map((p) => p.name).join(", ") || "Hike"}`,
      }))
    : []
  const hikeParam = Number(one(sp.hike))

  return (
    <div data-fullbleed className="h-[calc(100dvh-3rem-env(safe-area-inset-top)-3.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-3rem-env(safe-area-inset-top))]">
      <MapLoader
        styleUrl={process.env.MAP_STYLE_URL?.trim() || null}
        people={colors}
        personId={personId}
        lists={[{ value: "all", label: "All lists" }, ...lists.map((l) => ({ value: l.slug, label: l.short_name ? `${l.short_name} · ${l.name}` : l.name }))]}
        listSlug={listSlug}
        modes={COMPARE_MODES}
        mode={mode}
        peaks={[...byId.values()]}
        peakTotal={peakTotal}
        networks={networks}
        networkSlug={networkSlug}
        hikes={hikes}
        isAdmin={!!user.is_admin}
        focusHike={Number.isInteger(hikeParam) && hikeParam > 0 ? hikeParam : null}
      />
    </div>
  )
}
