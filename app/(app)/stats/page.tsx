import type { Metadata } from "next"

import { EmptyHikes } from "@/components/empty-hikes"
import { PageHeader } from "@/components/page-header"
import { BurnUpCard } from "@/components/stats/burn-up"
import { ClosestCard } from "@/components/stats/closest"
import { GridCard } from "@/components/stats/grid-card"
import { CalendarHeatmap, MonthHeatmap } from "@/components/stats/heatmaps"
import { Kpis } from "@/components/stats/kpis"
import { MixCard } from "@/components/stats/mix"
import { PartnersCard } from "@/components/stats/partners"
import { PeakListsCard } from "@/components/stats/peak-lists"
import { StatsControls } from "@/components/stats/stats-controls"
import { StreaksFunCard } from "@/components/stats/streaks-fun"
import { WinterBarsCard } from "@/components/stats/winter-bars"
import { YearBarsCard } from "@/components/stats/year-bars"
import { one } from "@/lib/format"
import { listPeople, requireUser } from "@/lib/queries"
import { getStats } from "@/lib/stats"

export const metadata: Metadata = { title: "Stats" }

export default async function StatsPage({ searchParams }: PageProps<"/stats">) {
  const user = await requireUser()
  const sp = await searchParams
  const people = listPeople()
  const withHikes = people.filter((p) => p.hikes > 0)
  const asNum = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null)
  const personId = people.find((p) => p.id === asNum(one(sp.person)))?.id ?? user.person_id ?? withHikes[0]?.id ?? people[0]?.id
  const withId = people.find((p) => p.id === asNum(one(sp.with)))?.id ?? null
  const year = asNum(one(sp.year))
  const stats = personId ? getStats({ personId, withId, year }) : null

  if (!stats) {
    return (
      <>
        <PageHeader title="Stats" />
        <EmptyHikes />
      </>
    )
  }
  const { core, compare, today } = stats
  const thisYear = Number(today.slice(0, 4))
  const first = core.person.name.split(" ")[0]

  return (
    <>
      <PageHeader
        title={`${first}'s stats`}
        description={compare ? `${core.person.name} against ${compare.person.name}, where a comparison makes sense.` : "How the hiking is going, and how close each list is to done."}
        actions={<StatsControls personId={core.person.id} withId={compare?.person.id ?? null} year={core.year} people={people.map((p) => ({ id: p.id, name: p.name }))} years={core.years} />}
      />

      {core.kpis.hikes === 0 ? (
        <EmptyHikes />
      ) : (
        <>
          <Kpis core={core} compare={compare} thisYear={thisYear} />
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-8">
              <BurnUpCard burnUps={core.burnUps} compareBurnUps={compare?.burnUps ?? null} name={first} compareName={compare?.person.name.split(" ")[0] ?? null} today={today} />
            </div>
            <div className="min-w-0 lg:col-span-4">
              <ClosestCard closest={core.closest} personId={core.person.id} />
            </div>
            <div className="min-w-0 lg:col-span-7">
              <YearBarsCard core={core} compare={compare} />
            </div>
            <div className="min-w-0 lg:col-span-5">
              <MixCard core={core} />
            </div>
            <div className="min-w-0 lg:col-span-12">
              <CalendarHeatmap core={core} />
            </div>
            <div className="min-w-0 lg:col-span-7">
              <MonthHeatmap core={core} />
            </div>
            <div className="min-w-0 lg:col-span-5">
              <WinterBarsCard core={core} />
            </div>
            <div className="min-w-0 lg:col-span-5">
              <GridCard lists={core.gridLists} />
            </div>
            <div className="min-w-0 lg:col-span-7">
              <PeakListsCard core={core} />
            </div>
            <div className="min-w-0 lg:col-span-7">
              <PartnersCard core={core} />
            </div>
            <div className="min-w-0 lg:col-span-5">
              <StreaksFunCard core={core} />
            </div>
          </div>
        </>
      )}
    </>
  )
}
