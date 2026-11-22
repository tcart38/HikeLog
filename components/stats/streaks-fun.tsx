import { ChartCard, nf } from "@/components/stats/stat-ui"
import { fmtDate } from "@/lib/format"
import type { Core } from "@/lib/stats"

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tracking-tight tnum">{value}</dd>
      {note && <dd className="text-[11px] leading-tight text-muted-foreground text-pretty">{note}</dd>}
    </div>
  )
}

export function StreaksFunCard({ core }: { core: Core }) {
  const s = core.streaks
  const f = core.fun
  return (
    <ChartCard title="Streaks and fun facts">
      <dl className="grid grid-cols-2 gap-2.5">
        <Fact label="Longest weekly streak" value={s.longestWeekStreak ? `${s.longestWeekStreak} wk` : "—"} note={s.weekStreakEnd ? `ending ${fmtDate(s.weekStreakEnd)}` : undefined} />
        <Fact label="Most hikes in a month" value={s.mostHikesInMonth ? String(s.mostHikesInMonth) : "—"} note={s.busiestMonthLabel ?? undefined} />
        <Fact
          label="Everests climbed"
          value={f.everests.toFixed(1)}
          note={f.everestBasis === "vert" ? "recorded vertical ÷ 29,032 ft" : "summit elevations added up ÷ 29,032 ft; real vertical is higher"}
        />
        <Fact label="Summit elevations" value={`${nf(f.summitElevationFt)} ft`} note="all peaks stacked end to end" />
        <Fact label="States with a summit" value={String(f.states.length)} note={f.states.join(", ") || undefined} />
        <Fact label="Longest break" value={s.longestGapDays ? `${s.longestGapDays} days` : "—"} note={s.currentWeekStreak ? `${s.currentWeekStreak}-week streak going` : "between hiking days"} />
      </dl>
    </ChartCard>
  )
}
