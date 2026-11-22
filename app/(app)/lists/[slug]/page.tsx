import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLinkIcon, GitCompareArrowsIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { PeakMatrix, type MatrixColumn, type MatrixRow } from "@/components/peak-matrix"
import { ProgressBar } from "@/components/progress-bar"
import { LeftOnlySwitch, PersonSwitcher, ViewTabs } from "@/components/url-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CONDITION_LABEL, monthSeason, one, parseView, type View } from "@/lib/format"
import { UserPrefs } from "@/lib/prefs"
import { getList, listProgress, tally, type Mode } from "@/lib/progress"
import { listPeople, peakCells, requireUser, type PeakCells } from "@/lib/queries"
import { MONTH_LABEL, SEASON_LABEL, SEASONS } from "@/lib/seasons"

export async function generateMetadata({ params }: PageProps<"/lists/[slug]">): Promise<Metadata> {
  const { slug } = await params
  return { title: getList(slug)?.name ?? "List" }
}

const MODE_FOR: Record<View, Mode> = { all: "all", winter: "winter", season: "season", grid: "grid", conditions: "all" }
const CONDS = ["snow", "no_snow", "mix"] as const

function columnsFor(view: View): MatrixColumn[] {
  switch (view) {
    case "all":
      return [{ key: "all", label: "First ascent" }]
    case "winter":
      return [{ key: "winter", label: "Winter ascent", tone: "winter" }]
    case "season":
      return SEASONS.map((s) => ({ key: s, label: SEASON_LABEL[s], tone: s }))
    case "grid":
      return MONTH_LABEL.map((m, i) => ({ key: String(i + 1), label: m, tone: monthSeason(i + 1) }))
    case "conditions":
      return CONDS.map((c) => ({ key: c, label: CONDITION_LABEL[c] }))
  }
}

function cellsFor(view: View, c: PeakCells | undefined) {
  switch (view) {
    case "all":
      return [{ done: !!c?.first, hikeId: c?.first, date: c?.firstDate }]
    case "winter":
      return [{ done: !!c?.winter, hikeId: c?.winter, date: c?.winterDate }]
    case "season":
      return SEASONS.map((s) => ({ done: !!c?.seasons[s], hikeId: c?.seasons[s] }))
    case "grid":
      return MONTH_LABEL.map((_, i) => ({ done: !!c?.months[i + 1], hikeId: c?.months[i + 1] }))
    case "conditions":
      return CONDS.map((k) => ({ done: !!c?.conditions[k], hikeId: c?.conditions[k] }))
  }
}

export default async function ListPage({ params, searchParams }: PageProps<"/lists/[slug]">) {
  const user = await requireUser()
  const { slug } = await params
  const sp = await searchParams
  const enabled = new UserPrefs(user.id).views(slug)
  const requestedView = parseView(one(sp.view))
  const view = enabled.includes(requestedView) ? requestedView : enabled[0]
  const leftOnly = one(sp.left) === "1"

  const people = listPeople()
  const requested = Number(one(sp.person))
  const personId = people.find((p) => p.id === requested)?.id ?? user.person_id ?? people[0]?.id
  const list = getList(slug)
  if (!list) notFound()
  if (!personId) notFound()
  const person = people.find((p) => p.id === personId)!

  const prog = listProgress(slug, personId, MODE_FOR[view])!
  const cells = peakCells(slug, personId)
  const columns = columnsFor(view)
  const units = columns.length

  const allRows: MatrixRow[] = prog.peaks.map((p) => {
    const cs = cellsFor(view, cells.get(p.id))
    return {
      slug: p.slug,
      name: p.name,
      elevationFt: p.elevation_ft,
      state: p.state,
      rank: p.rank,
      cells: cs,
      credit: cs.filter((c) => c.done).length,
      units,
      elective: !!p.elective,
      note: p.kind === "trail" ? p.notes : null,
    }
  })
  // Lists with electives ("pick 5 of these") count every required item plus only as many electives as the list asks for.
  const counted = tally(list, allRows.map((r, i) => ({ credit: r.credit, elective: prog.peaks[i].elective })), units)
  const done = counted.completed
  const credits = counted.credits
  const rows = leftOnly ? allRows.filter((r) => r.credit < r.units) : allRows
  const sources = (JSON.parse(list.sources_json || "[]") as { title: string; url: string }[]).filter((s) => s.url)

  const viewNoun = { all: "climbed", winter: "done in winter", season: "four-season", grid: "grid complete", conditions: "all three conditions" }[view]
  const condCounts = CONDS.map((k, i) => ({ k, n: view === "conditions" ? allRows.filter((r) => r.cells[i]?.done).length : 0 }))

  return (
    <>
      <PageHeader
        title={list.name}
        description={[list.region, list.organization].filter(Boolean).join(" · ")}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href={`/compare?list=${list.slug}&mode=${view === "conditions" ? "all" : view}`} />}>
            <GitCompareArrowsIcon /> Compare people
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-semibold tracking-tight tnum">{view === "conditions" ? condCounts[0].n : done}</span>
            <span className="text-sm text-muted-foreground tnum">
              {view === "conditions" ? `of ${counted.total} in snow` : `of ${counted.total} ${viewNoun} by ${person.name}`}
            </span>
            {(view === "season" || view === "grid") && (
              <span className="text-sm text-muted-foreground tnum">
                · {credits} of {counted.creditsTotal} {view === "grid" ? "month" : "season"} slots
              </span>
            )}
          </div>
          {view === "conditions" ? (
            <p className="text-sm text-muted-foreground tnum">
              {condCounts.map((c) => `${CONDITION_LABEL[c.k]} ${c.n}`).join(" · ")} of {counted.total}
            </p>
          ) : (
            <ProgressBar done={view === "season" || view === "grid" ? credits : done} total={view === "season" || view === "grid" ? counted.creditsTotal : counted.total} label={`${person.name} progress`} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PersonSwitcher value={personId} people={people} />
          <LeftOnlySwitch checked={leftOnly} />
        </div>
      </div>

      {enabled.length > 1 && <ViewTabs value={view} views={enabled} />}

      <PeakMatrix
        columns={columns}
        rows={rows}
        emptyLabel={leftOnly ? `${person.name} has done every peak in this view.` : "No peaks on this list."}
      />

      {(list.description || list.criteria || list.notes || sources.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>About this list</CardTitle>
          </CardHeader>
          <CardContent className="flex max-w-3xl flex-col gap-3 text-sm leading-relaxed">
            {list.description && <p>{list.description}</p>}
            {list.criteria && (
              <p>
                <span className="font-medium">Criteria. </span>
                {list.criteria}
              </p>
            )}
            {list.notes && (
              <p>
                <span className="font-medium">Notes. </span>
                {list.notes}
              </p>
            )}
            {sources.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-medium">Sources</span>
                <ul className="flex flex-col gap-1">
                  {sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                        {s.title} <ExternalLinkIcon className="size-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {list.official_url && (
              <a href={list.official_url} target="_blank" rel="noreferrer" className="w-fit">
                <Badge variant="outline">
                  Official site <ExternalLinkIcon />
                </Badge>
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
