"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import { ChartCard, Sparse } from "@/components/stats/stat-ui"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Core } from "@/lib/stats"

type Metric = "hikes" | "peaks"

export function YearBarsCard({ core, compare }: { core: Core; compare: Core | null }) {
  const [metric, setMetric] = React.useState<Metric>("peaks")
  const data = core.byYear.map((y) => ({
    year: String(y.year),
    a: y[metric],
    b: compare?.byYear.find((x) => x.year === y.year)?.[metric] ?? 0,
  }))
  // compare may have years outside this person's span
  if (compare) {
    for (const y of compare.byYear) if (!data.some((d) => d.year === String(y.year))) data.push({ year: String(y.year), a: 0, b: y[metric] })
    data.sort((x, y) => Number(x.year) - Number(y.year))
  }
  const config: ChartConfig = {
    a: { label: core.person.name, color: "var(--done)" },
    ...(compare ? { b: { label: compare.person.name, color: "var(--chart-2)" } } : {}),
  }
  return (
    <ChartCard
      title="Hikes and peaks per year"
      description={metric === "peaks" ? "Distinct peaks climbed each year." : "Hikes logged each year."}
      action={
        <ToggleGroup aria-label="Metric" value={[metric]} onValueChange={(v) => v[0] && setMetric(v[0] as Metric)} variant="outline" spacing={0} className="h-9">
          <ToggleGroupItem value="peaks" className="h-full px-3 data-[pressed]:bg-muted aria-pressed:bg-muted">Peaks</ToggleGroupItem>
          <ToggleGroupItem value="hikes" className="h-full px-3 data-[pressed]:bg-muted aria-pressed:bg-muted">Hikes</ToggleGroupItem>
        </ToggleGroup>
      }
    >
      {data.length === 0 ? (
        <Sparse>Nothing logged yet.</Sparse>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-60 w-full justify-start md:h-64" role="img" aria-label={`${metric} per year`}>
          <BarChart data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis hide domain={[0, "dataMax"]} />
            <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent />} />
            <Bar dataKey="a" fill="var(--color-a)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              <LabelList dataKey="a" position="top" className="fill-foreground text-[11px] tabular-nums" formatter={(v) => (Number(v) ? String(v) : "")} />
            </Bar>
            {compare && (
              <Bar dataKey="b" fill="var(--color-b)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                <LabelList dataKey="b" position="top" className="fill-muted-foreground text-[11px] tabular-nums" formatter={(v) => (Number(v) ? String(v) : "")} />
              </Bar>
            )}
            {compare && <ChartLegend content={<ChartLegendContent />} />}
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  )
}
