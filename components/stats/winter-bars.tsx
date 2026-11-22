"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import { ChartCard, Sparse } from "@/components/stats/stat-ui"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { Core } from "@/lib/stats"

const config: ChartConfig = {
  fresh: { label: "First winter ascent", color: "var(--season-winter)" },
  repeat: { label: "Repeat", color: "color-mix(in oklab, var(--season-winter) 38%, var(--card))" },
}

export function WinterBarsCard({ core }: { core: Core }) {
  const data = core.winterSeasons.map((w) => ({ label: w.label, fresh: w.newPeaks, repeat: Math.max(0, w.peaks - w.newPeaks), total: w.peaks, hikes: w.hikes }))
  return (
    <ChartCard title="Winter seasons" description="Peaks per astronomical winter (Dec solstice to Mar equinox). Start and end must fall inside the same winter.">
      {data.length === 0 ? (
        <Sparse>No winter hikes yet. The first one appears here.</Sparse>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-60 w-full justify-start" role="img" aria-label="Peaks per winter season">
          <BarChart data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
            <YAxis hide domain={[0, "dataMax"]} />
            <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent />} />
            <Bar dataKey="fresh" stackId="w" fill="var(--color-fresh)" maxBarSize={44} isAnimationActive={false} stroke="var(--card)" strokeWidth={1} />
            <Bar dataKey="repeat" stackId="w" fill="var(--color-repeat)" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              <LabelList dataKey="total" position="top" className="fill-foreground text-[11px] tabular-nums" formatter={(v) => (Number(v) ? String(v) : "")} />
            </Bar>
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  )
}
