"use client"

import Link from "next/link"

import { ChartCard, Sparse, nf } from "@/components/stats/stat-ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fmtDate } from "@/lib/format"
import type { Core } from "@/lib/stats"

function Row({ href, name, right, sub }: { href: string; name: string; right: string; sub?: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-10 items-baseline justify-between gap-3 py-2 text-sm transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 truncate">
          {name}
          {sub && <span className="ml-2 text-xs text-muted-foreground">{sub}</span>}
        </span>
        <span className="shrink-0 font-medium tnum">{right}</span>
      </Link>
    </li>
  )
}

function gapLabel(days: number) {
  if (days < 60) return `${days} days`
  if (days < 730) return `${Math.round(days / 30.4)} months`
  return `${(days / 365).toFixed(1)} years`
}

export function PeakListsCard({ core }: { core: Core }) {
  const none = core.mostClimbed.length === 0
  return (
    <ChartCard title="Peaks" description="Favourites, high points and the ones you have not seen in a while.">
      {none ? (
        <Sparse>Log a hike with peaks to fill this in.</Sparse>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {core.firstAscent && (
              <div>
                <dt className="text-xs text-muted-foreground">First logged ascent</dt>
                <dd className="text-pretty">
                  {core.firstAscent.peaks.slice(0, 2).join(", ")}
                  {core.firstAscent.peaks.length > 2 ? ` +${core.firstAscent.peaks.length - 2}` : ""} <span className="text-muted-foreground">on {fmtDate(core.firstAscent.date)}</span>
                </dd>
              </div>
            )}
            {core.lastAscent && (
              <div>
                <dt className="text-xs text-muted-foreground">Latest ascent</dt>
                <dd className="text-pretty">
                  {core.lastAscent.peaks.slice(0, 2).join(", ")}
                  {core.lastAscent.peaks.length > 2 ? ` +${core.lastAscent.peaks.length - 2}` : ""} <span className="text-muted-foreground">on {fmtDate(core.lastAscent.date)}</span>
                </dd>
              </div>
            )}
          </dl>
          <Tabs defaultValue="most">
            <TabsList>
              <TabsTrigger value="most">Most climbed</TabsTrigger>
              <TabsTrigger value="high">Highest</TabsTrigger>
              <TabsTrigger value="gap">Longest gap</TabsTrigger>
            </TabsList>
            <TabsContent value="most">
              <ul className="divide-y">
                {core.mostClimbed.map((p) => (
                  <Row key={p.slug} href={`/peaks/${p.slug}`} name={p.name} sub={p.elevationFt ? `${nf(p.elevationFt)} ft` : undefined} right={`${p.count}×`} />
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="high">
              <ul className="divide-y">
                {core.highest.map((p) => (
                  <Row key={p.slug} href={`/peaks/${p.slug}`} name={p.name} sub={`first ${fmtDate(p.first, { year: true })}`} right={`${nf(p.elevationFt)} ft`} />
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="gap">
              <ul className="divide-y">
                {core.longestGap.map((p) => (
                  <Row key={p.slug} href={`/peaks/${p.slug}`} name={p.name} sub={`last ${fmtDate(p.last)}`} right={gapLabel(p.days)} />
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </ChartCard>
  )
}
