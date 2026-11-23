import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"

import { EmptyHikes } from "@/components/empty-hikes"
import { HikeCard, hikeTitle } from "@/components/hike-parts"
import { HikeFilters } from "@/components/hike-filters"
import { PageHeader } from "@/components/page-header"
import { SeasonBadge } from "@/components/season-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CONDITION_LABEL, fmtRange, one } from "@/lib/format"
import { listHikes } from "@/lib/hikes"
import { listLists } from "@/lib/progress"
import { hikeCount, listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Hikes" }
const PAGE = 40

export default async function HikesPage({ searchParams }: PageProps<"/hikes">) {
  await requireUser()
  const sp = await searchParams
  const q = one(sp.q) ?? ""
  const person = one(sp.person) ?? ""
  const list = one(sp.list) ?? ""
  const page = Math.max(1, Number(one(sp.page)) || 1)

  const { hikes, total } = listHikes({
    q: q || undefined,
    personId: Number(person) || undefined,
    listSlug: list || undefined,
    limit: PAGE,
    offset: (page - 1) * PAGE,
  })
  const none = hikeCount() === 0
  const people = listPeople()
  const lists = listLists()
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const href = (p: number) => {
    const n = new URLSearchParams()
    if (q) n.set("q", q)
    if (person) n.set("person", person)
    if (list) n.set("list", list)
    if (p > 1) n.set("page", String(p))
    const s = n.toString()
    return s ? `/hikes?${s}` : "/hikes"
  }

  return (
    <>
      <PageHeader
        title="Hikes"
        description={none ? undefined : `${total.toLocaleString("en-US")} ${total === 1 ? "hike" : "hikes"}${q || person || list ? " match" : " logged"}`}
        actions={
          <Button size="lg" className="hidden h-9 md:inline-flex" nativeButton={false} render={<Link href="/hikes/new" />}>
            <PlusIcon /> Log a hike
          </Button>
        }
      />
      {none ? (
        <EmptyHikes />
      ) : (
        <>
          <HikeFilters
            key={`${q}|${person}|${list}`}
            q={q}
            person={person}
            list={list}
            people={people.map((p) => ({ value: String(p.id), label: p.name }))}
            lists={lists.map((l) => ({ value: l.slug, label: l.short_name || l.name }))}
          />
          {hikes.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hikes match these filters.</p>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl ring-1 ring-foreground/10 md:block">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-44">Date</TableHead>
                      <TableHead>Hike</TableHead>
                      <TableHead>People</TableHead>
                      <TableHead>Season</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead className="text-right">Miles</TableHead>
                      <TableHead className="text-right">Gain (ft)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hikes.map((h) => (
                      <TableRow key={h.id} className="relative">
                        <TableCell className="whitespace-nowrap">
                          <Link href={`/hikes/${h.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                            {fmtRange(h.date, h.endDate)}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate">{hikeTitle(h)}</div>
                          {h.peaks.length > 0 && (
                            <div className="truncate text-xs text-muted-foreground">
                              {h.peaks.length} {h.peaks.length === 1 ? "peak" : "peaks"}
                              {h.unmatchedPeaks.length > 0 && ` · ${h.unmatchedPeaks.length} unmatched`}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{h.participants.map((p) => p.name).join(", ")}</TableCell>
                        <TableCell>
                          <SeasonBadge season={h.season} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{h.conditions ? CONDITION_LABEL[h.conditions] : ""}</TableCell>
                        <TableCell className="text-right">{h.distanceMi ?? ""}</TableCell>
                        <TableCell className="text-right">{h.elevationGainFt?.toLocaleString("en-US") ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="flex flex-col gap-2 md:hidden">
                {hikes.map((h) => (
                  <li key={h.id}>
                    <HikeCard h={h} />
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
                  <Button variant="outline" className="h-10 md:h-8" disabled={page <= 1} nativeButton={page <= 1} render={page > 1 ? <Link href={href(page - 1)} /> : undefined}>
                    <ChevronLeftIcon /> Newer
                  </Button>
                  <span className="text-sm text-muted-foreground tnum">
                    Page {page} of {pages}
                  </span>
                  <Button variant="outline" className="h-10 md:h-8" disabled={page >= pages} nativeButton={page >= pages} render={page < pages ? <Link href={href(page + 1)} /> : undefined}>
                    Older <ChevronRightIcon />
                  </Button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}
