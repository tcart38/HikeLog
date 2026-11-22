"use client"

import * as React from "react"
import { Bar, BarChart, Cell, LabelList, ReferenceLine, XAxis, YAxis } from "recharts"

import { ChartCard, Ring, Sparse } from "@/components/stats/stat-ui"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { monthSeason } from "@/lib/format"
import { MONTH_LABEL } from "@/lib/seasons"
import type { Core } from "@/lib/stats"

const config: ChartConfig = { peaks: { label: "Peaks done in this month", color: "var(--done)" } }

export function GridCard({ lists }: { lists: Core["gridLists"] }) {
  const [slug, setSlug] = React.useState(lists.find((l) => l.slug === "nh-48")?.slug ?? lists[0]?.slug ?? "")
  const g = lists.find((l) => l.slug === slug) ?? lists[0]
  return (
    <ChartCard
      title="12-month grid"
      description="For each calendar month, how many peaks on the list you have done in that month."
      action={
        g && lists.length > 1 ? (
          <Select items={lists.map((l) => ({ value: l.slug, label: l.shortName }))} value={g.slug} onValueChange={(v) => v && setSlug(v)}>
            <SelectTrigger aria-label="Grid list" className="h-9 min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {lists.map((l) => (
                <SelectItem key={l.slug} value={l.slug}>
                  {l.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      {!g ? (
        <Sparse>No list has any month slots filled yet.</Sparse>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Ring value={g.filled / g.slots} size={56} stroke={6} />
            <p className="text-sm">
              <span className="text-lg font-semibold tnum">{g.filled}</span>
              <span className="text-muted-foreground"> of {g.slots} slots filled on {g.shortName} ({g.total} peaks × 12 months)</span>
            </p>
          </div>
          <ChartContainer config={config} className="aspect-auto h-44 w-full justify-start" role="img" aria-label="Peaks done per calendar month">
            <BarChart data={g.months.map((n, i) => ({ m: MONTH_LABEL[i], n, month: i + 1 }))} margin={{ top: 16, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="m" tickLine={false} axisLine={false} tickMargin={6} interval={0} tickFormatter={(v: string) => v.slice(0, 1)} />
              <YAxis hide domain={[0, g.total]} />
              <ReferenceLine y={g.total} stroke="var(--muted-foreground)" strokeDasharray="2 4" />
              <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent hideLabel nameKey="m" formatter={(v, _n, item) => <span className="tnum">{MONTH_LABEL[(item.payload.month as number) - 1]}: {String(v)} of {g.total}</span>} />} />
              <Bar dataKey="n" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={28}>
                {g.months.map((_, i) => (
                  <Cell key={i} fill={`var(--season-${monthSeason(i + 1)})`} />
                ))}
                <LabelList dataKey="n" position="top" className="fill-foreground text-[10px] tabular-nums" formatter={(v) => (Number(v) ? String(v) : "")} />
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="text-xs text-muted-foreground">Dashed line = every peak ({g.total}). Colour is the calendar-month season.</p>
        </div>
      )}
    </ChartCard>
  )
}
