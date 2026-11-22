import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, CheckIcon, MapPinIcon } from "lucide-react"

import { HikeCard } from "@/components/hike-parts"
import { PageHeader } from "@/components/page-header"
import { NeededBadge } from "@/components/season-badge"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtDate, fmtFt } from "@/lib/format"
import { listHikes } from "@/lib/hikes"
import { getPeak, listPeople, peakLists, requireUser } from "@/lib/queries"

export async function generateMetadata({ params }: PageProps<"/peaks/[slug]">): Promise<Metadata> {
  const { slug } = await params
  return { title: getPeak(slug)?.name ?? "Peak" }
}

export default async function PeakPage({ params }: PageProps<"/peaks/[slug]">) {
  await requireUser()
  const { slug } = await params
  const peak = getPeak(slug)
  if (!peak) notFound()
  const lists = peakLists(peak.id)
  const { hikes } = listHikes({ peakId: peak.id, limit: 200 })
  const people = listPeople()

  const summary = people
    .map((p) => {
      const mine = hikes.filter((h) => h.participants.some((x) => x.id === p.id && x.counts)).sort((a, b) => a.date.localeCompare(b.date))
      return {
        person: p,
        count: mine.length,
        first: mine[0]?.date,
        last: mine.at(-1)?.date,
        winter: mine.find((h) => h.isWinter)?.date,
        months: new Set(mine.map((h) => Number(h.date.slice(5, 7)))).size,
      }
    })
    .filter((s) => s.count > 0 || people.length <= 4)

  return (
    <>
      <Link href="/lists" className="inline-flex min-h-9 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Lists
      </Link>
      <PageHeader
        title={peak.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tnum">
            <span className="font-medium text-foreground">{fmtFt(peak.elevation_ft)}</span>
            {[peak.state, peak.range].filter(Boolean).join(" · ")}
            {peak.lat != null && peak.lon != null && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${peak.lat},${peak.lon}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <MapPinIcon className="size-3.5" /> {peak.lat.toFixed(3)}, {peak.lon.toFixed(3)}
              </a>
            )}
          </span>
        }
      />

      {lists.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Lists this peak is on">
          {lists.map((l) => (
            <li key={l.slug}>
              <Link href={`/lists/${l.slug}`}>
                <Badge variant="secondary" className="h-7 px-3 text-sm hover:bg-secondary/70">
                  {l.short_name || l.name}
                  {l.rank != null && <span className="text-muted-foreground tnum">#{l.rank}</span>}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {peak.notes && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{peak.notes}</p>}

      <section className="flex flex-col gap-2" aria-labelledby="who-h">
        <h2 id="who-h" className="text-base font-medium">
          Who has climbed it
        </h2>
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Ascents</TableHead>
                <TableHead className="hidden sm:table-cell">First</TableHead>
                <TableHead className="hidden sm:table-cell">Last</TableHead>
                <TableHead>Winter</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Months</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((s) => (
                <TableRow key={s.person.id}>
                  <TableCell className="font-medium">{s.person.name}</TableCell>
                  <TableCell className="text-right">{s.count || <NeededBadge>Not yet</NeededBadge>}</TableCell>
                  <TableCell className="hidden sm:table-cell">{s.first ? fmtDate(s.first) : ""}</TableCell>
                  <TableCell className="hidden sm:table-cell">{s.last ? fmtDate(s.last) : ""}</TableCell>
                  <TableCell>
                    {s.winter ? (
                      <span className="inline-flex items-center gap-1 text-season-winter">
                        <CheckIcon className="size-4" /> <span className="tnum">{fmtDate(s.winter, { year: true })}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{s.count ? "Needed" : ""}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">{s.count ? `${s.months}/12` : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="asc-h">
        <h2 id="asc-h" className="text-base font-medium">
          Every ascent
        </h2>
        {hikes.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nobody has logged {peak.name} yet.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {hikes.map((h) => (
              <li key={h.id}>
                <HikeCard h={h} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
