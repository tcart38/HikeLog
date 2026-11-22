import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon, GitCompareArrowsIcon, PlusIcon } from "lucide-react"

import { EmptyHikes } from "@/components/empty-hikes"
import { HikeCard } from "@/components/hike-parts"
import { PageHeader } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { ParamToggle } from "@/components/url-controls"
import { Button } from "@/components/ui/button"
import { one } from "@/lib/format"
import { listHikes } from "@/lib/hikes"
import { allListsProgress, MODES, type Mode } from "@/lib/progress"
import { hikeCount, listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Dashboard" }

const DASH_MODES = [
  { value: "all", label: "All" },
  { value: "winter", label: "Winter" },
  { value: "season", label: "Four-season" },
  { value: "grid", label: "Grid" },
]

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const user = await requireUser()
  const sp = await searchParams
  const q = one(sp.mode) as Mode
  const mode: Mode = DASH_MODES.some((m) => m.value === q) && MODES.includes(q) ? q : "all"
  const people = listPeople()
  const me = people.find((p) => p.id === user.person_id)
  const others = people.filter((p) => p.id !== me?.id)
  const total = hikeCount()

  const progress = me ? allListsProgress(me.id, mode) : []
  const units = mode === "season" ? 4 : mode === "grid" ? 12 : 1
  const pctOf = (r: (typeof progress)[number]) => (r.creditsTotal ? r.credits / r.creditsTotal : 0)
  const active = progress.filter((r) => r.credits > 0).sort((a, b) => pctOf(b) - pctOf(a))
  // Nothing tracked in this mode yet: show the headline lists so there is still somewhere to go.
  const featured = progress.filter((r) => ["nh-48", "ne-67", "adk-46", "nehh-100"].includes(r.list.slug))
  const shown = (active.length ? active : featured).slice(0, 8)
  const recent = me ? listHikes({ personId: me.id, limit: 5 }).hikes : listHikes({ limit: 5 }).hikes

  const greeting = me ? `Hi, ${me.name.split(" ")[0]}` : "Dashboard"

  return (
    <>
      <PageHeader
        title={greeting}
        description="Where your lists stand and what you did last."
        actions={
          <Button size="lg" className="hidden h-9 md:inline-flex" render={<Link href="/hikes/new" />}>
            <PlusIcon /> Log a hike
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyHikes />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="flex min-w-0 flex-col gap-3" aria-labelledby="progress-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="progress-h" className="text-base font-medium">
                Your progress
              </h2>
              <ParamToggle param="mode" label="Progress mode" value={mode} options={DASH_MODES} />
            </div>
            {shown.length ? (
              <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
                {shown.map((r) => (
                  <li key={r.list.id}>
                    <Link
                      href={`/lists/${r.list.slug}${mode === "all" ? "" : `?view=${mode}`}`}
                      className="flex min-h-16 flex-col justify-center gap-2 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">{r.list.name}</span>
                        <span className="shrink-0 text-sm tnum">
                          <span className="font-semibold">{units > 1 ? r.credits : r.completed}</span>
                          <span className="text-muted-foreground"> / {units > 1 ? r.creditsTotal : r.total}</span>
                        </span>
                      </div>
                      <ProgressBar
                        done={units > 1 ? r.credits : r.completed}
                        total={units > 1 ? r.creditsTotal : r.total}
                        label={`${r.list.name} progress`}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No lists to show yet.</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/lists" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary hover:underline">
                All lists <ArrowRightIcon className="size-3.5" />
              </Link>
              {others.length > 0 && (
                <Link
                  href={`/compare?list=nh-48&mode=winter&people=${[me?.id, others[0].id].filter(Boolean).join(",")}`}
                  className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <GitCompareArrowsIcon className="size-4" /> What do {me?.name.split(" ")[0] ?? "we"} and {others[0].name.split(" ")[0]} both still need?
                </Link>
              )}
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-3" aria-labelledby="recent-h">
            <div className="flex items-center justify-between">
              <h2 id="recent-h" className="text-base font-medium">
                Recent hikes
              </h2>
              <Link href="/hikes" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary hover:underline">
                All hikes <ArrowRightIcon className="size-3.5" />
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {recent.map((h) => (
                <li key={h.id}>
                  <HikeCard h={h} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  )
}
