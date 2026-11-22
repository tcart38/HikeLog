import type { Metadata } from "next"
import Link from "next/link"
import { CheckIcon, MinusIcon } from "lucide-react"

import { CompareControls } from "@/components/compare-controls"
import { PageHeader } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { COMPARE_MODES, fmtDate, fmtFt, one } from "@/lib/format"
import { compare, listLists, MODES, unitsFor, type CompareRow, type Mode } from "@/lib/progress"
import { listPeople, requireUser } from "@/lib/queries"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Compare" }

const joinNames = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`)
const unitWord = (mode: Mode) => (mode === "grid" ? "months" : mode === "season" ? "seasons" : "")

function PeakLine({ r, ids, names, units, mode }: { r: CompareRow; ids: number[]; names: Map<number, string>; units: number; mode: Mode }) {
  return (
    <li className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 md:min-h-10">
      <Link href={`/peaks/${r.slug}`} className="min-w-0 truncate font-medium hover:underline">
        {r.name}
      </Link>
      <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground tnum">
        {units > 1 &&
          ids.map((id) => (
            <span key={id} className={cn(r.byPerson[id].done ? "text-done" : "")} title={`${names.get(id)}: ${r.byPerson[id].credit}/${units} ${unitWord(mode)}`}>
              {names.get(id)!.split(" ")[0][0]} {r.byPerson[id].credit}/{units}
            </span>
          ))}
        <span>{fmtFt(r.elevation_ft)}</span>
      </span>
    </li>
  )
}

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  await requireUser()
  const sp = await searchParams
  const people = listPeople()
  const lists = listLists()
  const names = new Map(people.map((p) => [p.id, p.name]))

  const slug = lists.find((l) => l.slug === one(sp.list))?.slug ?? lists.find((l) => l.slug === "nh-48")?.slug ?? lists[0]?.slug
  const modeParam = one(sp.mode) as Mode
  const mode: Mode = MODES.includes(modeParam) && COMPARE_MODES.some((m) => m.value === modeParam) ? modeParam : slug === "nh-48" ? "winter" : "all"

  const requested = (one(sp.people) ?? "")
    .split(",")
    .map(Number)
    .filter((id) => names.has(id))
  const withLogin = people.filter((p) => p.user_id)
  const defaults = (withLogin.length >= 2 ? withLogin : people).slice(0, 2).map((p) => p.id)
  const ids = [...new Set(requested.length ? requested : defaults)]

  const listOptions = lists.map((l) => ({ value: l.slug, label: l.short_name ? `${l.short_name} · ${l.name}` : l.name }))
  const header = <PageHeader title="Compare" description="Who still needs what, and what you can do together." />

  if (!slug || people.length < 2) {
    return (
      <>
        {header}
        <Empty className="border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckIcon />
            </EmptyMedia>
            <EmptyTitle>Add a second person to compare</EmptyTitle>
            <EmptyDescription>Comparison needs at least two people. Add your partner or a hiking friend, then log hikes with both of you on them.</EmptyDescription>
          </EmptyHeader>
          <Link href="/settings#people" className="text-sm font-medium text-primary hover:underline">
            Add a person
          </Link>
        </Empty>
      </>
    )
  }

  const result = compare(slug, ids, mode)!
  const units = unitsFor(mode)
  const n = ids.length
  const modeLabel = COMPARE_MODES.find((m) => m.value === mode)?.label.toLowerCase() ?? mode
  const modePhrase = mode === "all" ? "" : mode === "winter" ? " in winter" : mode === "season" ? " in all four seasons" : " for the 12-month grid"

  // Group by exactly who still needs the peak.
  const groups = new Map<string, { missing: number[]; rows: CompareRow[] }>()
  for (const r of result.peaks) {
    if (r.missingFor.length === 0) continue
    const key = [...r.missingFor].sort().join(",")
    ;(groups.get(key) ?? groups.set(key, { missing: [...r.missingFor].sort(), rows: [] }).get(key)!).rows.push(r)
  }
  const ordered = [...groups.values()].sort((a, b) => b.missing.length - a.missing.length || a.missing[0] - b.missing[0])
  const doneByAll = result.peaks.filter((r) => r.missingFor.length === 0)
  const everyone = ordered.find((g) => g.missing.length === n)
  const rest = ordered.filter((g) => g !== everyone)

  const labelFor = (missing: number[]) =>
    missing.length === 1 ? `Only ${names.get(missing[0])} needs` : `${joinNames(missing.map((m) => names.get(m)!))} still need`

  return (
    <>
      {header}
      <CompareControls
        list={slug}
        lists={listOptions}
        mode={mode}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        selected={ids}
      />

      {ids.length < 2 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Pick at least two people to compare.</p>
      ) : (
        <>
          {/* The answer first: what everyone still needs. */}
          <section aria-labelledby="hero-h" className="flex flex-col gap-4 rounded-xl bg-primary/[0.06] p-4 ring-1 ring-primary/25 md:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-semibold tracking-tight text-primary tnum dark:text-done md:text-5xl">{result.summary.allNeed}</span>
              <h2 id="hero-h" className="text-base font-medium md:text-lg">
                {result.summary.allNeed === 1 ? "peak" : "peaks"} {joinNames(ids.map((i) => names.get(i)!))} {n === 2 ? "both" : "all"} still need{modePhrase}
              </h2>
            </div>
            {everyone ? (
              <ul className="grid divide-y rounded-lg bg-background ring-1 ring-foreground/10 md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b xl:grid-cols-3">
                {everyone.rows.map((r) => (
                  <PeakLine key={r.id} r={r} ids={ids} names={names} units={units} mode={mode} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing left that {n === 2 ? "you both" : "everyone"} needs. Anything still open is just one person&apos;s.
              </p>
            )}
          </section>

          <section aria-label="Progress per person" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ids.map((id) => {
              const s = result.summary.perPerson[id]
              return (
                <div key={id} className="flex flex-col gap-2 rounded-xl p-4 ring-1 ring-foreground/10">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{names.get(id)}</span>
                    <span className="text-sm tnum">
                      <span className="font-semibold">{s.done}</span>
                      <span className="text-muted-foreground"> / {result.summary.total}</span>
                    </span>
                  </div>
                  <ProgressBar done={s.done} total={result.summary.total} label={`${names.get(id)} ${modeLabel} progress`} />
                  <span className="text-xs text-muted-foreground tnum">
                    {s.remaining} left · {s.onlyTheyNeed} only {names.get(id)!.split(" ")[0]} needs
                  </span>
                </div>
              )
            })}
          </section>

          {rest.map((g) => (
            <section key={g.missing.join(",")} className="flex flex-col gap-2" aria-label={labelFor(g.missing)}>
              <h2 className="flex items-baseline gap-2 text-base font-medium">
                {labelFor(g.missing)}
                <span className="text-sm font-normal text-muted-foreground tnum">{g.rows.length}</span>
              </h2>
              <ul className="grid divide-y rounded-xl ring-1 ring-foreground/10 md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b xl:grid-cols-3">
                {g.rows.map((r) => (
                  <PeakLine key={r.id} r={r} ids={ids} names={names} units={units} mode={mode} />
                ))}
              </ul>
            </section>
          ))}

          {doneByAll.length > 0 && (
            <details className="group flex flex-col gap-2">
              <summary className="flex min-h-10 cursor-pointer list-none items-baseline gap-2 text-base font-medium [&::-webkit-details-marker]:hidden">
                Done by everyone
                <span className="text-sm font-normal text-muted-foreground tnum">{doneByAll.length}</span>
                <span className="text-sm font-normal text-primary group-open:hidden">Show</span>
                <span className="hidden text-sm font-normal text-primary group-open:inline">Hide</span>
              </summary>
              <ul className="grid divide-y rounded-xl ring-1 ring-foreground/10 md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b xl:grid-cols-3">
                {doneByAll.map((r) => (
                  <PeakLine key={r.id} r={r} ids={ids} names={names} units={units} mode={mode} />
                ))}
              </ul>
            </details>
          )}

          {/* Desktop: the whole list as a matrix. */}
          <section className="hidden flex-col gap-2 md:flex" aria-labelledby="matrix-h">
            <h2 id="matrix-h" className="text-base font-medium">
              Every peak
            </h2>
            <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 text-right">#</TableHead>
                    <TableHead>Peak</TableHead>
                    <TableHead className="text-right">Elevation</TableHead>
                    {ids.map((id) => (
                      <TableHead key={id} className="w-40">
                        {names.get(id)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.peaks.map((r) => (
                    <TableRow key={r.id} className={cn(r.missingFor.length === n && "bg-remaining/60", r.missingFor.length === 0 && "text-muted-foreground")}>
                      <TableCell className="text-right text-muted-foreground">{r.rank}</TableCell>
                      <TableCell>
                        <Link href={`/peaks/${r.slug}`} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtFt(r.elevation_ft)}</TableCell>
                      {ids.map((id) => {
                        const c = r.byPerson[id]
                        const date = mode === "winter" ? c.status.firstWinter : c.status.first
                        return (
                          <TableCell key={id}>
                            {units > 1 ? (
                              <span className={cn("tnum", c.done ? "font-medium text-done" : c.credit ? "" : "text-muted-foreground")}>
                                {c.credit}/{units}
                              </span>
                            ) : c.done ? (
                              <span className="inline-flex items-center gap-1.5 text-done">
                                <CheckIcon className="size-4" strokeWidth={3} />
                                <span className="text-xs text-muted-foreground tnum">{date ? fmtDate(date) : ""}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-remaining-foreground">
                                <MinusIcon className="size-4" aria-hidden /> <span className="sr-only">Needed</span>
                              </span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
