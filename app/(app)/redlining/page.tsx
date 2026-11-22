import type { Metadata } from "next"
import Link from "next/link"
import { ArrowDownIcon, ArrowUpIcon, InfoIcon, MapIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { DownloadNetworkButton } from "@/components/redlining/download-button"
import { RedliningControls } from "@/components/redlining/redlining-controls"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { networkCoverage, TRAIL_DONE_SHARE, trailProgress, type PersonCoverage, type TrailProgress } from "@/lib/coverage"
import { one } from "@/lib/format"
import { groupNotes, listNetworks } from "@/lib/networks"
import { listPeople, requireUser } from "@/lib/queries"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Redlining" }

const mi = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })
const pctText = (p: number) => `${p > 0 && p < 10 ? p.toFixed(1) : Math.round(p)}%`
const joinNames = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`)
const SORTS = ["name", "length", "pct", "left"] as const
type Sort = (typeof SORTS)[number]
const PAGE = 100

function PersonBars({ people, cov, total, compact }: { people: { id: number; name: string }[]; cov: PersonCoverage[]; total: number; compact?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {people.map((p) => {
        const c = cov.find((x) => x.personId === p.id)
        return (
          <li key={p.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground tnum">
                <span className="font-semibold text-foreground">{pctText(c?.percent ?? 0)}</span>
                {compact ? "" : ` · ${mi(c?.coveredMi ?? 0)} of ${mi(total)} mi`}
              </span>
            </div>
            <ProgressBar done={c?.coveredMi ?? 0} total={total} label={`${p.name}: ${pctText(c?.percent ?? 0)}`} />
            {compact && <span className="text-xs text-muted-foreground tnum">{mi(c?.coveredMi ?? 0)} of {mi(total)} mi</span>}
          </li>
        )
      })}
    </ul>
  )
}

export default async function RedliningPage({ searchParams }: PageProps<"/redlining">) {
  const user = await requireUser()
  const sp = await searchParams
  const people = listPeople()
  const names = new Map(people.map((p) => [p.id, p.name]))
  const requested = (one(sp.people) ?? "").split(",").map(Number).filter((id) => names.has(id))
  const withLogin = people.filter((p) => p.user_id)
  const mine = people.find((p) => p.id === user.person_id)
  const defaults = (withLogin.length >= 2 ? withLogin.slice(0, 2) : mine ? [mine] : people.slice(0, 1)).map((p) => p.id)
  const ids = [...new Set(requested.length ? requested : defaults)]
  const selected = ids.map((id) => ({ id, name: names.get(id)! }))

  const networks = listNetworks()
  const notes = groupNotes()
  const netParam = one(sp.network)
  const net = networks.find((n) => n.slug === netParam) ?? networks.find((n) => n.fetched_at) ?? networks[0]
  const cov = new Map(networks.filter((n) => n.fetched_at).map((n) => [n.slug, networkCoverage(n.id, ids)]))
  const isAdmin = !!user.is_admin

  const groups = new Map<string, typeof networks>()
  for (const n of networks) (groups.get(n.group_slug ?? n.slug) ?? groups.set(n.group_slug ?? n.slug, []).get(n.group_slug ?? n.slug)!).push(n)

  // detail for the selected network
  const sortParam = one(sp.sort) as Sort
  const sort: Sort = SORTS.includes(sortParam) ? sortParam : "pct"
  const dir = one(sp.dir) === "asc" ? "asc" : one(sp.dir) === "desc" ? "desc" : sort === "name" ? "asc" : "desc"
  const showAll = one(sp.all) === "1"
  const trails: TrailProgress[] = net?.fetched_at ? trailProgress(net.id, ids) : []
  const lead = ids[0]
  const sorted = [...trails].sort((a, b) => {
    const v =
      sort === "name" ? a.name.localeCompare(b.name, undefined, { numeric: true }) : sort === "length" ? a.lengthMi - b.lengthMi : sort === "left" ? a.neededByAllMi - b.neededByAllMi : (a.byPerson[lead]?.share ?? 0) - (b.byPerson[lead]?.share ?? 0)
    return (dir === "asc" ? v : -v) || a.name.localeCompare(b.name, undefined, { numeric: true })
  })
  const shown = showAll ? sorted : sorted.slice(0, PAGE)

  const href = (over: Record<string, string | null>) => {
    const q = new URLSearchParams()
    if (net) q.set("network", net.slug)
    if (requested.length) q.set("people", ids.join(","))
    q.set("sort", sort)
    q.set("dir", dir)
    if (showAll) q.set("all", "1")
    for (const [k, v] of Object.entries(over)) {
      if (v === null) q.delete(k)
      else q.set(k, v)
    }
    return `/redlining?${q}`
  }
  const sortLink = (key: Sort, label: string, className?: string) => {
    const active = sort === key
    const nextDir = active ? (dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc"
    return (
      <Link href={href({ sort: key, dir: nextDir })} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground", className)} aria-label={`Sort by ${label}`}>
        {label}
        {active && (dir === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
      </Link>
    )
  }

  // "both still need": group trails by exactly who has not finished them
  const doneBy = (t: TrailProgress, id: number) => (t.byPerson[id]?.share ?? 0) >= TRAIL_DONE_SHARE
  const needGroups = new Map<string, { missing: number[]; rows: TrailProgress[] }>()
  for (const t of trails) {
    const missing = ids.filter((id) => !doneBy(t, id))
    if (!missing.length) continue
    const k = missing.join(",")
    ;(needGroups.get(k) ?? needGroups.set(k, { missing, rows: [] }).get(k)!).rows.push(t)
  }
  const orderedGroups = [...needGroups.values()].sort((a, b) => b.missing.length - a.missing.length || a.missing[0] - b.missing[0])
  const everyone = orderedGroups.find((g) => g.missing.length === ids.length)
  const doneByAll = trails.filter((t) => ids.every((id) => doneBy(t, id)))
  const bothMi = trails.reduce((a, t) => a + t.neededByAllMi, 0)
  const n = ids.length

  const netOptions = networks.map((x) => ({ value: x.slug, label: x.fetched_at ? x.name : `${x.name} (not downloaded)` }))
  const groupNote = net?.group_slug ? notes[net.group_slug]?.note : undefined

  return (
    <>
      <PageHeader
        title="Redlining"
        description="Hike every trail in a network. A GPS track or a mark by hand both count."
        actions={
          <Button variant="outline" className="h-10 md:h-8" nativeButton={false} render={<Link href={`/map${net ? `?network=${net.slug}` : ""}`} />}>
            <MapIcon /> Open the map
          </Button>
        }
      />

      <RedliningControls people={people.map((p) => ({ id: p.id, name: p.name }))} selected={ids} networks={netOptions} network={net?.slug ?? ""} />

      {/* Networks */}
      <section className="flex flex-col gap-6" aria-labelledby="networks-h">
        <h2 id="networks-h" className="sr-only">
          Trail networks
        </h2>
        {[...groups.entries()]
          .sort((a, b) => Number(b[1].some((x) => x === net)) - Number(a[1].some((x) => x === net)) || Number(b[1].some((x) => x.fetched_at)) - Number(a[1].some((x) => x.fetched_at)))
          .map(([slug, items]) => {
          const info = notes[slug]
          const downloaded = items.filter((x) => x.fetched_at)
          const multi = items.length > 1
          const total = downloaded.reduce((a, x) => a + x.total_length_mi, 0)
          const groupCov: PersonCoverage[] = ids.map((id) => {
            const c = downloaded.reduce((a, x) => a + (cov.get(x.slug)?.find((y) => y.personId === id)?.coveredMi ?? 0), 0)
            return { personId: id, coveredMi: Math.round(c * 10) / 10, totalMi: total, percent: total ? Math.round((c / total) * 1000) / 10 : 0, trailsDone: 0 }
          })
          return (
            <div key={slug} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-base font-medium">{info?.name ?? items[0].name}</h3>
                  {info?.description && <p className="max-w-2xl text-sm text-muted-foreground">{info.description}</p>}
                </div>
                {multi && isAdmin && downloaded.length < items.length && <DownloadNetworkButton slug={slug} name={info?.name ?? slug} size="sm" />}
              </div>
              {multi && downloaded.length > 0 && (
                <div className="flex flex-col gap-3 rounded-xl bg-primary/[0.06] p-4 ring-1 ring-primary/25">
                  <p className="text-sm font-medium">
                    All downloaded sections <span className="font-normal text-muted-foreground tnum">· {downloaded.length} of {items.length} sections, {mi(total)} mi</span>
                  </p>
                  <PersonBars people={selected} cov={groupCov} total={total} />
                </div>
              )}
              <ul className={cn("grid gap-3", multi ? "sm:grid-cols-2 xl:grid-cols-3" : "max-w-2xl")}>
                {items.map((x) => (
                  <li key={x.slug} className={cn("flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10", net?.slug === x.slug && "ring-2 ring-primary/50")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col">
                        <Link href={href({ network: x.slug })} className="font-medium hover:underline">
                          {x.name}
                        </Link>
                        <span className="text-xs text-muted-foreground tnum">
                          {x.fetched_at ? `${mi(x.total_length_mi)} mi · ${x.trail_count.toLocaleString("en-US")} trails` : "Not downloaded yet"}
                        </span>
                      </div>
                      {x.fetched_at && (
                        <Link href={`/map?network=${x.slug}&person=${lead}`} aria-label={`${x.name} on the map`} className="-m-2 p-2 text-muted-foreground hover:text-foreground">
                          <MapIcon className="size-4" />
                        </Link>
                      )}
                    </div>
                    {x.fetched_at ? (
                      <PersonBars people={selected} cov={cov.get(x.slug) ?? []} total={x.total_length_mi} compact={multi} />
                    ) : null}
                    {isAdmin ? (
                      <div>
                        <DownloadNetworkButton slug={x.slug} name={x.name} redownload={!!x.fetched_at} size="sm" />
                      </div>
                    ) : (
                      !x.fetched_at && <p className="text-xs text-muted-foreground">Ask an admin to download this network.</p>
                    )}
                  </li>
                ))}
              </ul>
              {info?.note && !multi && (
                <Alert>
                  <InfoIcon />
                  <AlertTitle>Where this data comes from</AlertTitle>
                  <AlertDescription>{info.note}</AlertDescription>
                </Alert>
              )}
            </div>
          )
        })}
        {groupNote && groups.get(net!.group_slug!)!.length > 1 && (
          <Alert>
            <InfoIcon />
            <AlertTitle>Where this data comes from</AlertTitle>
            <AlertDescription>{groupNote}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* Detail for the selected network */}
      {net && net.fetched_at && (
        <>
          {n >= 2 && (
            <section aria-labelledby="both-h" className="flex flex-col gap-4 rounded-xl bg-primary/[0.06] p-4 ring-1 ring-primary/25 md:p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl font-semibold tracking-tight text-primary tnum dark:text-done md:text-5xl">{mi(bothMi)}</span>
                <h2 id="both-h" className="text-base font-medium md:text-lg">
                  miles of {net.name} that {joinNames(selected.map((s) => s.name))} {n === 2 ? "both" : "all"} still need
                </h2>
              </div>
              {everyone ? (
                <>
                  <p className="text-sm text-muted-foreground tnum">
                    {everyone.rows.length} trails nobody has finished. The longest ones:
                  </p>
                  <ul className="grid divide-y rounded-lg bg-background ring-1 ring-foreground/10 md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b xl:grid-cols-3">
                    {[...everyone.rows]
                      .sort((a, b) => b.neededByAllMi - a.neededByAllMi)
                      .slice(0, 12)
                      .map((t) => (
                        <li key={t.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 md:min-h-10">
                          <span className="min-w-0 truncate font-medium">{t.name}</span>
                          <span className="shrink-0 text-sm text-muted-foreground tnum">{t.neededByAllMi.toFixed(1)} mi left</span>
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Every trail is finished by at least one of you.</p>
              )}
              {orderedGroups
                .filter((g) => g !== everyone)
                .map((g) => (
                  <details key={g.missing.join(",")} className="group">
                    <summary className="flex min-h-10 cursor-pointer list-none items-baseline gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      {g.missing.length === 1 ? `Only ${names.get(g.missing[0])} needs` : `${joinNames(g.missing.map((m) => names.get(m)!))} still need`}
                      <span className="font-normal text-muted-foreground tnum">{g.rows.length} trails</span>
                      <span className="font-normal text-primary group-open:hidden">Show</span>
                      <span className="hidden font-normal text-primary group-open:inline">Hide</span>
                    </summary>
                    <ul className="mt-1 grid divide-y rounded-lg bg-background ring-1 ring-foreground/10 md:grid-cols-2 md:divide-y-0 md:[&>li]:border-b xl:grid-cols-3">
                      {g.rows.slice(0, 30).map((t) => (
                        <li key={t.id} className="flex min-h-10 items-center justify-between gap-3 px-4 py-2">
                          <span className="min-w-0 truncate">{t.name}</span>
                          <span className="shrink-0 text-sm text-muted-foreground tnum">{t.lengthMi.toFixed(1)} mi</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              {doneByAll.length > 0 && <p className="text-xs text-muted-foreground tnum">{doneByAll.length} trails are done by everyone.</p>}
            </section>
          )}

          <section aria-labelledby="trails-h" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="trails-h" className="text-base font-medium">
                {net.name} trails <span className="text-sm font-normal text-muted-foreground tnum">{trails.length.toLocaleString("en-US")}</span>
              </h2>
              <p className="text-xs text-muted-foreground">Done means {Math.round(TRAIL_DONE_SHARE * 100)}% or more hiked.</p>
            </div>
            <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <div
                className="hidden items-center gap-4 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid"
                style={{ gridTemplateColumns: `minmax(0,2fr) 5rem repeat(${ids.length}, minmax(0,1fr)) 5rem` }}
              >
                {sortLink("name", "Trail")}
                {sortLink("length", "Length", "justify-end")}
                {selected.map((p, i) => (
                  <span key={p.id}>{i === 0 ? sortLink("pct", p.name) : p.name}</span>
                ))}
                {sortLink("left", "Still needed", "justify-end text-right")}
              </div>
              <ul className="divide-y">
                {shown.map((t) => (
                  <li key={t.id} className="px-4 py-2.5 md:min-h-12">
                    <div className="grid items-center gap-x-4 gap-y-1.5 md:min-h-8 md:[grid-template-columns:var(--cols)]" style={{ ["--cols" as string]: `minmax(0,2fr) 5rem repeat(${ids.length}, minmax(0,1fr)) 5rem` }}>
                      <Link href={`/map?network=${net.slug}&person=${lead}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                        {t.name}
                      </Link>
                      <span className="text-sm text-muted-foreground tnum md:text-right">{t.lengthMi.toFixed(1)} mi</span>
                      {selected.map((p) => {
                        const c = t.byPerson[p.id]
                        return (
                          <div key={p.id} className="flex items-center gap-2" title={`${p.name}: ${c.coveredMi} mi`}>
                            <ProgressBar done={c.percent} total={100} label={`${p.name} on ${t.name}`} className="min-w-0 flex-1" />
                            <span className={cn("w-9 shrink-0 text-right text-xs tnum", c.share >= TRAIL_DONE_SHARE ? "font-medium text-done" : "text-muted-foreground")}>{c.percent}%</span>
                          </div>
                        )
                      })}
                      <span className="text-sm text-muted-foreground tnum md:text-right">{t.neededByAllMi > 0 ? `${t.neededByAllMi.toFixed(1)} mi` : "done"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {!showAll && trails.length > PAGE && (
              <Link href={href({ all: "1" })} className="text-sm font-medium text-primary hover:underline">
                Show all {trails.length.toLocaleString("en-US")} trails
              </Link>
            )}
          </section>
        </>
      )}
    </>
  )
}
