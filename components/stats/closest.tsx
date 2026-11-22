"use client"

import * as React from "react"
import Link from "next/link"

import { ChartCard, Ring, Sparse } from "@/components/stats/stat-ui"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Core } from "@/lib/stats"

const MODES = [
  { value: "all", label: "All", view: "" },
  { value: "winter", label: "Winter", view: "winter" },
  { value: "season", label: "4-season", view: "season" },
  { value: "grid", label: "Grid", view: "grid" },
] as const

export function ClosestCard({ closest, personId }: { closest: Core["closest"]; personId: number }) {
  const [mode, setMode] = React.useState<(typeof MODES)[number]["value"]>("all")
  const rows = closest[mode]
  const view = MODES.find((m) => m.value === mode)!.view
  return (
    <ChartCard
      title="Closest to finishing"
      description="Fewest left first."
      action={
        <div className="-mx-1 max-w-full overflow-x-auto px-1 scroll-quiet">
          <ToggleGroup aria-label="Mode" value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as typeof mode)} variant="outline" spacing={0} className="h-9 w-max">
            {MODES.map((m) => (
              <ToggleGroupItem key={m.value} value={m.value} className="h-full px-3 data-[pressed]:bg-muted aria-pressed:bg-muted">
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      }
    >
      {rows.length === 0 ? (
        <Sparse>Nothing started in this mode yet.</Sparse>
      ) : (
        <ul className="flex flex-col divide-y">
          {rows.slice(0, 6).map((r) => (
            <li key={r.slug}>
              <Link
                href={`/lists/${r.slug}?person=${personId}${view ? `&view=${view}` : ""}`}
                className="flex min-h-14 items-center gap-3 py-2 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Ring value={r.total ? r.done / r.total : 0} size={44} stroke={5} color={r.remaining === 0 ? "var(--done)" : "var(--done)"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.shortName}</span>
                  <span className="block text-xs text-muted-foreground tnum">
                    {r.done} of {r.total} {r.unit}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {r.remaining === 0 ? (
                    <span className="text-sm font-semibold text-done">Finished</span>
                  ) : (
                    <>
                      <span className="block text-lg leading-none font-semibold tnum">{r.remaining}</span>
                      <span className="text-[11px] text-muted-foreground">to go</span>
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}
