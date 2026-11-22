import { ChartCard, Sparse, heatBg } from "@/components/stats/stat-ui"
import { fmtDate } from "@/lib/format"
import { MONTH_LABEL } from "@/lib/seasons"
import type { Core } from "@/lib/stats"
import { cn } from "@/lib/utils"

const DAY = 86400000

function Legend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
      Fewer
      {[0, 1, 2, 3].map((n) => (
        <span key={n} className="size-3 rounded-[3px]" style={{ background: heatBg(n) }} />
      ))}
      More
    </div>
  )
}

/** GitHub-style grid of hiking days for one year. Multi-day trips fill every day they cover. */
export function CalendarHeatmap({ core }: { core: Core }) {
  const y = core.year
  const counts = new Map(core.calendar.map((c) => [c.date, c.count]))
  const jan1 = Date.UTC(y, 0, 1)
  const startDow = (new Date(jan1).getUTCDay() + 6) % 7 // Monday = 0
  const days = Math.round((Date.UTC(y + 1, 0, 1) - jan1) / DAY)
  const cells = Array.from({ length: days }, (_, i) => {
    const date = new Date(jan1 + i * DAY).toISOString().slice(0, 10)
    return { date, col: Math.floor((i + startDow) / 7) + 1, row: ((i + startDow) % 7) + 1, count: counts.get(date) ?? 0 }
  })
  const cols = cells[cells.length - 1].col
  const monthStarts = Array.from({ length: 12 }, (_, m) => ({ m, col: cells.find((c) => c.date === `${y}-${String(m + 1).padStart(2, "0")}-01`)!.col }))
  const s = core.yearSummary
  return (
    <ChartCard
      title={`${y} on the trail`}
      description={
        s.days
          ? `${s.days} day${s.days === 1 ? "" : "s"} out, ${s.hikes} hike${s.hikes === 1 ? "" : "s"}, ${s.peaks} peak${s.peaks === 1 ? "" : "s"} (${s.newPeaks} new)${s.busiestMonth ? `. Busiest month: ${s.busiestMonth}.` : "."}`
          : "No hikes logged this year."
      }
      action={<Legend />}
    >
      <div className="-mx-1 overflow-x-auto px-1 pb-1 scroll-quiet">
        <div className="w-max min-w-full">
          <div className="grid gap-[3px] pb-1 text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${cols}, 15px)` }} aria-hidden>
            {monthStarts.map((m) => (
              <span key={m.m} style={{ gridColumn: `${m.col} / span 4`, gridRow: 1 }}>
                {MONTH_LABEL[m.m]}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${cols}, 15px)`, gridTemplateRows: "repeat(7, 15px)" }}
            role="img"
            aria-label={`Hiking days in ${y}: ${s.days} days`}
          >
            {cells.map((c) => (
              <span
                key={c.date}
                title={`${fmtDate(c.date)}${c.count ? `: ${c.count} hike${c.count === 1 ? "" : "s"}` : ""}`}
                className="rounded-[3px] ring-1 ring-inset ring-foreground/[0.04]"
                style={{ gridColumn: c.col, gridRow: c.row, background: heatBg(c.count) }}
              />
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  )
}

/** Year x month matrix of hike counts, with the number in each cell. */
export function MonthHeatmap({ core }: { core: Core }) {
  const rows = [...core.byMonth].reverse()
  const total = core.kpis.hikes
  return (
    <ChartCard title="Hikes by month" description="Every year against every month. Darker means more hikes.">
      {total === 0 ? (
        <Sparse>Nothing logged yet.</Sparse>
      ) : (
        <div className="overflow-x-auto scroll-quiet" role="table" aria-label="Hikes per month per year">
          <div className="min-w-[22rem]" role="rowgroup">
            <div className="grid grid-cols-[2.5rem_repeat(12,minmax(0,1fr))] gap-[3px] pb-1 text-[11px] text-muted-foreground" role="row">
              <span />
              {MONTH_LABEL.map((m) => (
                <span key={m} className="text-center" role="columnheader">
                  <span className="sm:hidden">{m[0]}</span>
                  <span className="hidden sm:inline">{m}</span>
                </span>
              ))}
            </div>
            {rows.map((r) => (
              <div key={r.year} className="mb-[3px] grid grid-cols-[2.5rem_repeat(12,minmax(0,1fr))] gap-[3px]" role="row">
                <span className="self-center text-xs text-muted-foreground tnum" role="rowheader">
                  {r.year}
                </span>
                {r.counts.map((n, i) => (
                  <span
                    key={i}
                    role="cell"
                    title={`${MONTH_LABEL[i]} ${r.year}: ${n} hike${n === 1 ? "" : "s"}`}
                    aria-label={`${MONTH_LABEL[i]} ${r.year}: ${n}`}
                    className={cn("flex h-7 items-center justify-center rounded-[4px] text-[11px] font-medium tnum", n >= 3 ? "text-done-foreground" : n === 0 ? "text-transparent" : "text-foreground")}
                    style={{ background: heatBg(n) }}
                  >
                    {n || "0"}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  )
}
