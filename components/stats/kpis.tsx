import type { Core } from "@/lib/stats"
import { nf } from "@/components/stats/stat-ui"
import { cn } from "@/lib/utils"

type Tile = { label: string; value: string; sub?: string; other?: string; muted?: boolean }

/** Headline numbers. Horizontal scroll-snap strip on phones, 4-up grid from md. */
export function Kpis({ core, compare, thisYear }: { core: Core; compare: Core | null; thisYear: number }) {
  const k = core.kpis
  const c = compare?.kpis
  const delta = k.peaksThisYear - k.peaksLastYear
  const tiles: Tile[] = [
    { label: "Hikes", value: nf(k.hikes), other: c && `${compare!.person.name}: ${nf(c.hikes)}` },
    { label: "Unique peaks", value: nf(k.uniquePeaks), other: c && `${compare!.person.name}: ${nf(c.uniquePeaks)}` },
    { label: "Total ascents", value: nf(k.totalAscents), sub: k.uniquePeaks ? `${(k.totalAscents / k.uniquePeaks).toFixed(1)} per peak` : undefined, other: c && `${compare!.person.name}: ${nf(c.totalAscents)}` },
    { label: "Days on trail", value: nf(k.daysOnTrail), other: c && `${compare!.person.name}: ${nf(c.daysOnTrail)}` },
    k.milesHikes
      ? { label: "Miles", value: nf(Math.round(k.miles)), sub: `from ${k.milesHikes} of ${k.hikes} hikes`, other: c && `${compare!.person.name}: ${nf(Math.round(c.miles))}` }
      : { label: "Miles", value: "—", sub: "Not recorded yet", muted: true },
    k.vertHikes
      ? { label: "Vertical", value: `${nf(k.vertFt)} ft`, sub: `from ${k.vertHikes} of ${k.hikes} hikes`, other: c && `${compare!.person.name}: ${nf(c.vertFt)} ft` }
      : { label: "Vertical", value: "—", sub: "Not recorded yet", muted: true },
    {
      label: `Peaks in ${thisYear}`,
      value: nf(k.peaksThisYear),
      sub: k.peaksLastYear || k.peaksThisYear ? `${delta === 0 ? "same as" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs`} ${thisYear - 1} (${k.peaksLastYear})` : undefined,
      other: c && `${compare!.person.name}: ${nf(c.peaksThisYear)}`,
    },
    {
      label: "Everests climbed",
      value: core.fun.everests.toFixed(1),
      sub: core.fun.everestBasis === "vert" ? "from recorded vertical" : "from summit elevations",
    },
  ]
  return (
    <ul
      aria-label="Headline numbers"
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scroll-quiet md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0"
    >
      {tiles.map((t) => (
        <li
          key={t.label}
          className="flex min-h-[5.5rem] w-[40%] shrink-0 snap-start flex-col justify-between rounded-xl bg-card p-3.5 ring-1 ring-foreground/10 md:w-auto"
        >
          <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
          <span className={cn("text-2xl font-semibold tracking-tight tnum md:text-[1.7rem]", t.muted && "text-muted-foreground/60")}>{t.value}</span>
          <span className="min-h-4 text-[11px] leading-tight text-muted-foreground">{t.other ?? t.sub ?? " "}</span>
          {t.other && t.sub && <span className="sr-only">{t.sub}</span>}
        </li>
      ))}
    </ul>
  )
}
