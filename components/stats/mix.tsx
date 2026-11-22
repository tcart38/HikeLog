"use client"

import { Cell, Pie, PieChart } from "recharts"

import { ChartCard, Sparse } from "@/components/stats/stat-ui"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { CONDITION_LABEL } from "@/lib/format"
import { SEASONS, SEASON_LABEL } from "@/lib/seasons"
import type { Core } from "@/lib/stats"

const COND_COLOR = { snow: "var(--season-winter)", no_snow: "var(--season-summer)", mix: "var(--chart-2)", unknown: "var(--muted)" } as const

export function MixCard({ core }: { core: Core }) {
  const total = core.kpis.hikes
  const seasonData = SEASONS.map((s) => ({ key: s, name: SEASON_LABEL[s], value: core.seasonMix[s] }))
  const config: ChartConfig = Object.fromEntries(SEASONS.map((s) => [s, { label: SEASON_LABEL[s], color: `var(--season-${s})` }]))
  const c = core.conditionsMix
  const cond = (["snow", "no_snow", "mix", "unknown"] as const).filter((k) => c[k] > 0)
  const known = c.snow + c.no_snow + c.mix
  return (
    <ChartCard title="Season and conditions" description="When you hike, and what was underfoot.">
      {total === 0 ? (
        <Sparse>Nothing logged yet.</Sparse>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="relative size-36 shrink-0">
              <ChartContainer config={config} className="aspect-square size-36" role="img" aria-label="Hikes by season">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
                  <Pie data={seasonData} dataKey="value" nameKey="key" innerRadius={44} outerRadius={66} paddingAngle={2} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
                    {seasonData.map((d) => (
                      <Cell key={d.key} fill={`var(--season-${d.key})`} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold tnum">{total}</span>
                <span className="text-[11px] text-muted-foreground">hikes</span>
              </div>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
              {seasonData.map((d) => (
                <li key={d.key} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--season-${d.key})` }} />
                  <span className="flex-1">{d.name}</span>
                  <span className="font-medium tnum">{d.value}</span>
                  <span className="w-9 text-right text-xs text-muted-foreground tnum">{Math.round((d.value / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Conditions</span>
              <span className="text-xs text-muted-foreground">{known ? `${known} of ${total} recorded` : "Not recorded yet"}</span>
            </div>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={cond.map((k) => `${k === "unknown" ? "Unrecorded" : CONDITION_LABEL[k]} ${c[k]}`).join(", ")}>
              {cond.map((k) => (
                <span key={k} style={{ width: `${(c[k] / total) * 100}%`, background: COND_COLOR[k] }} title={`${k === "unknown" ? "Unrecorded" : CONDITION_LABEL[k]}: ${c[k]}`} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {cond.map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px]" style={{ background: COND_COLOR[k] }} />
                  {k === "unknown" ? "Unrecorded" : CONDITION_LABEL[k]} <span className="font-medium text-foreground tnum">{c[k]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ChartCard>
  )
}
