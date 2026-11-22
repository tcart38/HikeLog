"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import { ChartCard, Sparse } from "@/components/stats/stat-ui"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fmtDate } from "@/lib/format"
import type { BurnUp } from "@/lib/stats"

const ms = (d: string) => new Date(`${d}T12:00:00Z`).getTime()
type Mode = "all" | "winter" | "both"

function stepAt(series: { t: string; n: number }[], t: number): number {
  let v = 0
  for (const p of series) {
    if (ms(p.t) <= t) v = p.n
    else break
  }
  return v
}

export function BurnUpCard({
  burnUps,
  compareBurnUps,
  name,
  compareName,
  today,
}: {
  burnUps: BurnUp[]
  compareBurnUps: BurnUp[] | null
  name: string
  compareName: string | null
  today: string
}) {
  const preferred = burnUps.find((b) => b.slug === "nh-48") ?? burnUps[0]
  const [slug, setSlug] = React.useState(preferred?.slug ?? "")
  const [mode, setMode] = React.useState<Mode>("both")
  const b = burnUps.find((x) => x.slug === slug) ?? preferred
  const cb = compareBurnUps?.find((x) => x.slug === b?.slug) ?? null

  const { data, config, lastT } = React.useMemo(() => {
    if (!b) return { data: [], config: {} as ChartConfig, lastT: 0 }
    const todayMs = ms(today)
    const showAll = mode !== "winter"
    const showWin = mode !== "all"
    const cfg: ChartConfig = {}
    const keys: { key: string; s: { t: string; n: number }[] }[] = []
    if (showAll) {
      cfg.a_all = { label: `${name} all-season`, color: "var(--done)" }
      keys.push({ key: "a_all", s: b.all })
      if (cb) {
        cfg.b_all = { label: `${compareName} all-season`, color: "var(--chart-2)" }
        keys.push({ key: "b_all", s: cb.all })
      }
    }
    if (showWin) {
      cfg.a_win = { label: `${name} winter`, color: "var(--season-winter)" }
      keys.push({ key: "a_win", s: b.winter })
      if (cb) {
        cfg.b_win = { label: `${compareName} winter`, color: "color-mix(in oklab, var(--season-winter) 55%, var(--muted-foreground))" }
        keys.push({ key: "b_win", s: cb.winter })
      }
    }
    const eta = showAll && mode === "all" && b.paceAll.etaDate ? ms(b.paceAll.etaDate) : null
    if (eta) cfg.proj = { label: "Projected", color: "var(--done)" }
    const times = new Set<number>([todayMs])
    for (const { s } of keys) for (const p of s) times.add(ms(p.t))
    const first = Math.min(...times)
    times.add(first - 86400000 * 20)
    if (eta) times.add(eta)
    const rows = [...times].sort((x, y) => x - y).map((t) => {
      const row: Record<string, number | null> = { t }
      for (const { key, s } of keys) row[key] = t <= todayMs ? stepAt(s, t) : null
      if (eta) row.proj = t === todayMs ? stepAt(b.all, t) : t === eta ? b.total : null
      return row
    })
    return { data: rows, config: cfg, lastT: eta ?? todayMs }
  }, [b, cb, mode, name, compareName, today])

  if (!b) {
    return (
      <ChartCard title="List progress over time" description="Cumulative peaks finished on each list.">
        <Sparse>No list has progress yet. Log a hike with a listed peak and it shows up here.</Sparse>
      </ChartCard>
    )
  }

  const firstT = data[0]?.t as number
  const yearTicks: number[] = []
  for (let y = new Date(firstT).getUTCFullYear() + 1; y <= new Date(lastT).getUTCFullYear(); y++) yearTicks.push(Date.UTC(y, 0, 1))
  const sentences = [mode !== "winter" && b.paceAll.sentence, mode !== "all" && b.paceWinter.sentence].filter(Boolean) as string[]

  return (
    <ChartCard
      title="List progress over time"
      description="Cumulative peaks finished, from your first hike to today."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Select items={burnUps.map((x) => ({ value: x.slug, label: x.shortName }))} value={b.slug} onValueChange={(v) => v && setSlug(v)}>
            <SelectTrigger aria-label="List" className="h-9 min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {burnUps.map((x) => (
                <SelectItem key={x.slug} value={x.slug}>
                  {x.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup aria-label="Mode" value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as Mode)} variant="outline" spacing={0} className="h-9">
            {(["both", "all", "winter"] as const).map((m) => (
              <ToggleGroupItem key={m} value={m} className="h-full px-3 capitalize data-[pressed]:bg-muted aria-pressed:bg-muted">
                {m === "both" ? "Both" : m === "all" ? "All-season" : "Winter"}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ChartContainer config={config} className="aspect-auto h-64 w-full justify-start md:h-72" role="img" aria-label={`${b.name} cumulative progress`}>
          <LineChart data={data} margin={{ top: 12, right: 28, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={[firstT, lastT]} ticks={yearTicks} tickFormatter={(t) => String(new Date(t).getUTCFullYear())} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis domain={[0, b.total]} ticks={[0, Math.round(b.total / 2), b.total]} width={30} tickLine={false} axisLine={false} />
            <ReferenceLine y={b.total} stroke="var(--muted-foreground)" strokeDasharray="2 4" />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={<ChartTooltipContent labelFormatter={(_, p) => fmtDate(new Date(Number(p?.[0]?.payload?.t)).toISOString().slice(0, 10))} />}
            />
            {Object.keys(config).map((key) => (
              <Line
                key={key}
                dataKey={key}
                type={key === "proj" ? "linear" : "stepAfter"}
                stroke={`var(--color-${key})`}
                strokeWidth={key.startsWith("a") || key === "proj" ? 2.5 : 2}
                strokeDasharray={key.startsWith("b") || key === "proj" ? "5 4" : undefined}
                strokeOpacity={key === "proj" ? 0.7 : 1}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                connectNulls
                isAnimationActive={false}
                legendType="plainline"
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
        <div className="flex flex-col gap-1.5 text-sm">
          <p className="tnum">
            <span className="font-semibold">{mode === "winter" ? b.paceWinter.done : b.paceAll.done}</span>
            <span className="text-muted-foreground"> of {b.total} {mode === "winter" ? "done in winter" : "done"}{mode === "both" ? ` (${b.paceWinter.done} in winter)` : ""}</span>
          </p>
          {sentences.map((s) => (
            <p key={s} className="text-pretty text-muted-foreground">
              {s}
            </p>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}
